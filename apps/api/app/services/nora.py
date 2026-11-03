"""Nora, the in-app nutrition assistant: one Claude call per message. See docs/api.md.

Nora answers questions about food and the user's log, suggests meals that fit what's left of
the day, and explains the plan. It never sets or changes targets: the plan's numbers stay the
algorithm's alone (docs/plans/ai-nutrition-plan.md, decision 2) — Nora reads them, it doesn't
move them. People the plan protects (a safety gate stopped their plan, or they told us about
pregnancy, an eating disorder, kidney disease or weight-loss surgery) get Nora without calorie
or weight talk, and their context carries no numbers to talk about.

Nothing is stored: the app sends the whole conversation with each message. What reaches
Anthropic is that conversation and a short summary of the user's day — health data, under the
before-launch GDPR check in the plan doc.
"""

from __future__ import annotations

import logging
from datetime import date
from functools import lru_cache

import anthropic
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models.user import User
from app.schemas.nora import ChatMessage
from app.services import food_log, users
from app.services.nutrition_plan import plans

logger = logging.getLogger(__name__)

# Chat is short answers to everyday questions: low effort keeps replies quick and cheap.
EFFORT = "low"
MAX_TOKENS = 16000
# A declined reply is retried server-side on the model Anthropic recommends for its category.
FALLBACK_BETA = "server-side-fallback-2026-07-01"

# What the plan treats as needing protection: no calorie or weight talk from Nora.
PROTECTED_HEALTH = {"pregnant", "eating_disorder", "kidney", "bariatric"}

# Never changes between requests, so it is cached (the per-user context comes after it).
SYSTEM_PROMPT = """You are Nora, the nutrition assistant inside the Nora app, a food log and nutrition planner used mostly in Romania.

What you do:
- Answer questions about food, meals and nutrition, and about the user's own log and targets, using the context below.
- Suggest meals and snacks that fit what the user has left today, their allergies and what they like. Prefer foods easy to find in Romanian shops, with simple portions (grams, cups, slices, pieces).
- Explain the user's plan and targets in plain words.

What you never do:
- Set, change or second-guess calorie or macro targets, or tell the user to eat more or less than them. Targets come from the app's plan, which the user changes in the Strategy tab. If they want different targets, point them there.
- Diagnose, treat or give medical advice, or advise on medication or supplement doses. For a medical condition, symptoms or medication, tell them to ask their doctor or a registered dietitian.
- Recommend crash diets, long fasts, very low intakes, purging, or "compensating" for food eaten.

How you answer:
- Reply in the language the user writes in (Romanian or English).
- Be warm, short and practical: a few sentences, or a short list. Plain text only, no headings or tables.
- Use the numbers in the context; for anything else, give estimates and say they are approximate. Never invent exact values.
- If someone seems distressed about food, their body or eating, or mentions harming themselves, respond with care, don't give food advice, and encourage them to talk to a doctor or someone they trust; in an emergency, 112.
- If asked about something unrelated to food, nutrition or the app, say briefly that you can help with food and nutrition.
- Don't add a medical disclaimer to every reply; the app shows one under the chat."""

PROTECTED_RULE = """This person is in the app's protected group. Do not mention calories, kilojoules, calorie targets, weight, weight loss, or restricting portions, and don't give numbers for any of them, even if asked; if they ask, kindly say it isn't something Nora helps with for them, and suggest their doctor or dietitian. Talk instead about regular, varied, enjoyable meals, eating enough, and how food fits their day."""


class NoraUnavailable(RuntimeError):
    """Nora isn't set up (no API key) or the key was refused: not the user's fault."""


class NoraBusy(RuntimeError):
    """Claude couldn't answer right now (rate limit, overload, network): worth retrying."""


@lru_cache
def get_client() -> anthropic.Anthropic | None:
    """The Claude client, or None without an API key. Also a FastAPI dependency, so tests
    can swap in a fake."""
    key = get_settings().anthropic_api_key
    return anthropic.Anthropic(api_key=key) if key else None


def is_protected(db: Session, user: User) -> bool:
    if users.targets_mode(user) == "none":
        return True
    goal = plans.latest_goal(db, user)
    health = set((goal.answers.get("health") or []) if goal else [])
    return bool(health & PROTECTED_HEALTH)


def day_context(db: Session, user: User, day: date) -> str:
    """What Nora knows about the user today, as text after the cached system prompt."""
    protected = is_protected(db, user)
    goal = plans.latest_goal(db, user)
    answers = goal.answers if goal else {}
    entries = food_log.list_entries(db, user.id, day)

    lines = [f"Today is {day.isoformat()} ({day.strftime('%A')})."]
    if entries:
        lines.append("Logged today:")
        for e in entries:
            grams = float(e.grams)
            # The meal, not the time: logged_at is stored in UTC, the user lives in their own zone.
            what = f"- {e.meal}: {e.name}, {e.amount.normalize():f} {e.unit} ({grams:.0f} g)"
            if not protected:
                k = grams / 100
                what += (
                    f": {float(e.kcal_per_100g) * k:.0f} kcal, {float(e.protein_per_100g) * k:.0f} g protein, "
                    f"{float(e.carbs_per_100g) * k:.0f} g carbs, {float(e.fat_per_100g) * k:.0f} g fat"
                )
            lines.append(what)
    else:
        lines.append("Nothing logged yet today.")

    if not protected:
        totals = food_log.daily_totals(db, user.id, day, day)[0]
        lines.append(
            f"Eaten so far: {totals.kcal:.0f} kcal, {totals.protein:.0f} g protein, "
            f"{totals.carbs:.0f} g carbs, {totals.fat:.0f} g fat."
        )
        targets = users.targets(user)
        if targets is not None:
            source = "their nutrition plan" if users.targets_mode(user) == "plan" else "the app's defaults"
            lines.append(
                f"Daily targets (from {source}): {targets.kcal:.0f} kcal, {targets.protein_g:.0f} g protein, "
                f"{targets.carbs_g:.0f} g carbs, {targets.fat_g:.0f} g fat, {targets.fiber_g:.0f} g fibre. "
                f"Left today: {max(0, targets.kcal - totals.kcal):.0f} kcal, "
                f"{max(0, targets.protein_g - totals.protein):.0f} g protein."
            )
        maintenance = plans.maintenance_kcal(db, user)
        if maintenance:
            lines.append(f"Estimated daily burn (from the plan): about {maintenance} kcal.")

    if allergies := answers.get("allergies"):
        lines.append(f"Allergies: {', '.join(allergies)}. Never suggest foods containing these.")
    if style := answers.get("eating_style"):
        lines.append(f"Eating style: {style}.")
    if protected:
        lines.append(PROTECTED_RULE)
    return "\n".join(lines)


def reply(client: anthropic.Anthropic, context: str, messages: list[ChatMessage]) -> str:
    """Nora's answer to the conversation's last message."""
    try:
        response = client.beta.messages.create(
            model=get_settings().nora_model,
            max_tokens=MAX_TOKENS,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            output_config={"effort": EFFORT},
            system=[
                {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}},
                {"type": "text", "text": context},
            ],
            messages=[{"role": m.role, "content": m.content} for m in messages],
        )
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as exc:
        logger.error("Nora's Anthropic key was refused: %s", exc)
        raise NoraUnavailable("Nora isn't available right now.") from exc
    except anthropic.RateLimitError as exc:
        raise NoraBusy("Nora is busy. Try again in a moment.") from exc
    except anthropic.BadRequestError:
        # Our request is malformed: a bug to fix, not something to retry.
        logger.exception("Nora's request was rejected")
        raise
    except (anthropic.APIStatusError, anthropic.APIConnectionError) as exc:
        logger.warning("Nora couldn't reach Claude: %s", exc)
        raise NoraBusy("Nora couldn't answer just now. Try again in a moment.") from exc

    if response.stop_reason == "refusal":
        return "I can't help with that one. Try asking about a meal, a food or your day."
    text = "\n".join(block.text for block in response.content if block.type == "text").strip()
    if response.stop_reason == "max_tokens":
        logger.warning("Nora's reply hit max_tokens")
    return text or "Sorry, I didn't catch that. Could you ask again?"
