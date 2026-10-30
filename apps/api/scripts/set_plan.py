#!/usr/bin/env python
"""Put a user on the basic or premium plan, by hand, until payments exist.

    python scripts/set_plan.py you@example.com premium
    python scripts/set_plan.py you@example.com basic

The plan is set with no expiry. The user must have signed in to the app at least once.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow running as a plain script from the repo root, without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal  # noqa: E402
from app.db.models.user import PLANS  # noqa: E402
from app.services.users import UserLookupError, find_by_email, set_plan  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("email", help="email of the user")
    parser.add_argument("plan", choices=PLANS)
    args = parser.parse_args()

    with SessionLocal() as db:
        try:
            user = find_by_email(db, args.email)
        except UserLookupError as exc:
            print(f"Nothing changed: {exc}.")
            return 1
        set_plan(db, user, args.plan)
        print(f"{user.email} (user {user.id}) is now on the {args.plan} plan.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
