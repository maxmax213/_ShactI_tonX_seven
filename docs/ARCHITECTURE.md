# Architecture Notes

## Backend bounded contexts

- `auth`: JWT login/register and current user session.
- `users`: profile, role data, parent-student links and user stats.
- `courses`: course -> module -> lesson structure and enrollment by code.
- `assignments`: task definitions (`python`, `blocks`, `test`).
- `submissions`: student solutions, auto-check for tests, teacher grading.
- `comments`: communication within assignment context.
- `gamification`: achievements, XP rewards, leaderboard.
- `parental`: read-only parent analytics for linked children.

Each backend context follows:
- `models.py`
- `schemas.py`
- `service.py`
- `router.py`

## Frontend slices

- `app/`: auth provider, API layer, route shell.
- `pages/`: role-focused dashboards.
- `components/`: reusable cards/layout widgets.

## Scaling guidance

1. Add a new feature as a separate folder under `app/modules/`.
2. Keep business rules in `service.py`; keep router thin.
3. Expose only DTOs from `schemas.py`; do not leak ORM models to frontend.
4. In frontend, add role-specific pages first, then extract common UI pieces.
5. Use Docker compose for reproducible team environment.
