#!/usr/bin/env python
"""Give the food log from before accounts existed to its owner.

    python scripts/claim_shared_log.py you@example.com

Before sign-in, everyone shared one food log. Its entries have no user, so nobody sees them
any more. Sign in to the app once (that creates your user), then run this in each
environment that has such entries: it assigns every entry without a user to the user with
this email. Refuses an email that no user, or more than one, has.

Once it has run everywhere, a follow-up migration can make food_log_entries.user_id NOT NULL.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow running as a plain script from the repo root, without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal  # noqa: E402
from app.services.users import UserLookupError, claim_unowned_entries, find_by_email  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("email", help="email of the user to give the entries to")
    args = parser.parse_args()

    with SessionLocal() as db:
        try:
            user = find_by_email(db, args.email)
        except UserLookupError as exc:
            print(f"Nothing assigned: {exc}.")
            return 1
        count = claim_unowned_entries(db, user)
        print(f"Assigned {count} entries without a user to {user.email} (user {user.id}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
