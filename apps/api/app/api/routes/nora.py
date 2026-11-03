"""Nora, the in-app nutrition assistant. See docs/api.md.

Premium only. The logic and its guardrails are in `app/services/nora.py`.
"""

from datetime import date

import anthropic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.db.session import get_db
from app.schemas.nora import ChatReply, ChatRequest
from app.services import nora
from app.services.auth import AUTH_RESPONSES, require_plan

PREMIUM_ONLY = "Nora is a premium feature."

router = APIRouter(
    prefix="/nora",
    tags=["Nora"],
    responses={**AUTH_RESPONSES, 403: {"description": PREMIUM_ONLY}},
)


@router.post(
    "/chat",
    response_model=ChatReply,
    summary="Ask Nora",
    description=(
        "Nora's answer to the last message of a conversation: questions about food and the "
        "user's log, meal ideas that fit what's left of the day, the plan explained. The app "
        "sends the whole conversation each time (oldest first, from and to a user message) "
        "and keeps it on the phone; nothing is stored here. Nora sees the day's log, the "
        "targets and the plan's allergies, and never changes targets. Users the plan protects "
        "get no calorie or weight talk. Premium only."
    ),
    responses={
        422: {"description": "The conversation is empty or too long, or doesn't start and end with the user's message."},
        503: {"description": "Nora isn't set up on this server, or Claude couldn't answer right now; try again."},
    },
)
def chat(
    body: ChatRequest,
    user: User = Depends(require_plan("premium", detail=PREMIUM_ONLY)),
    db: Session = Depends(get_db),
    client: anthropic.Anthropic | None = Depends(nora.get_client),
) -> ChatReply:
    if body.messages[0].role != "user" or body.messages[-1].role != "user":
        raise HTTPException(422, detail="the conversation must start and end with the user's message")
    if client is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Nora isn't available right now.")
    context = nora.day_context(db, user, body.date or date.today())
    try:
        return ChatReply(reply=nora.reply(client, context, body.messages))
    except (nora.NoraUnavailable, nora.NoraBusy) as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
