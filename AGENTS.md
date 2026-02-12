# Agent Instructions

## Package Manager Policy

- In `frontend/`, use `bun` for dependency installation and script execution.
- Do not use `npm`, `yarn`, or `pnpm` in `frontend/` unless `bun` fails.
- If `bun` fails and a fallback is used, report the failure and the exact fallback command that was run.

## Backend Python Policy

- In `backend/`, use `uv` for environment and command execution.
- Do not create or activate manual virtual environments for backend work.
- Prefer commands like:
  - `uv sync`
  - `uv run python main.py`
  - `uv run pytest`
