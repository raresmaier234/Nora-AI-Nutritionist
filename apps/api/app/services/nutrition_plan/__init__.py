"""The premium nutrition plan: safety gates, the algorithm, and the plan texts.

Spec: docs/plans/ai-nutrition-plan.md (v3); the reasons behind its numbers are in
docs/plans/ai-nutrition-plan-expert-review.md. Only the algorithm decides numbers; no AI runs
per request.

- `person.py` — the person behind the answers: age (the youngest possible from birth month
  and year), BMI, protein weight, health flags.
- `gates.py` — the safety gates (stop, maintain only, caps, notes) and target validation.
- `algorithm.py` — energy (BMR, TDEE), paces and their limits, calories (clamp first, then the
  date), macros, fibre and display rounding. Pure functions.
- `texts.py` and `patterns/` — the pattern library and its renderer.
- `plans.py` — goals and plans in the database, and the previews, for the routes.

Everything but `plans.py` is pure: no database, no clock (callers pass `today`).
"""
