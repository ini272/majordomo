# NFC Trigger Setup Guide

Last verified: 2026-04-27

## Overview

NFC tags link to a Majordomo trigger URL. When a logged-in user scans a tag, Majordomo completes a quest for that user and shows the reward result.

Current behavior:

- NFC tags point to a public NFC code, not a raw template ID.
- The NFC code resolves to one NFC-enabled quest template.
- If the user has an active quest from the scanned template, the oldest active matching quest is completed.
- If there is no active matching quest, Majordomo creates a quest instance from the template and completes it immediately.
- Duplicate scans of the same NFC template by the same user within 30 seconds are ignored and do not award rewards again.
- If the user is not logged in, the app sends them to login and then resumes the trigger URL.

## Backend

- Endpoint: `POST /api/triggers/nfc/{nfc_code}`
- Authentication: required JWT Bearer token
- Duplicate cooldown: 30 seconds per `home_id + user_id + quest_template_id`
- Response: quest completion details, rewards, user stats, trigger source, and duplicate status

## Frontend

- Route: `/t/:nfcCode`
- Production URL shape: `http://majordomo/t/<nfc_code>`
- Dev URL shape: `http://majordomo:3000/t/<nfc_code>`
- API wiring:
  - Production Docker/Caddy serves the frontend on port 80 and reverse-proxies `/api` to the backend.
  - Vite dev derives `http://<same-host>:8000/api` when opened on port 3000.

## NFC Tag Configuration

Write a URI record to the tag:

```text
http://majordomo/t/<nfc_code>
```

Example:

```text
http://majordomo/t/trash-bin
```

Use the Tailscale/MagicDNS hostname, not a LAN IP. The tag should not include `localhost`, a laptop IP, or the dev port unless you are intentionally testing against the Vite dev server.

## Enabling A Template For NFC

Open the template in template edit mode and use the NFC section:

- Enable `Use for NFC`
- Set or adjust the `NFC code`
- Copy the generated `Tag URL`

Example:

- `NFC code`: `trash-bin`
- `Tag URL`: `http://majordomo/t/trash-bin`

Keep `nfc_code` stable once written to a physical tag. The tag can keep working through template name/reward/schedule edits as long as the code remains assigned to that template.

## Testing Without NFC Hardware

Production-style test:

1. Ensure the server stack is running and reachable through Tailscale.
2. Open:

   ```text
   http://majordomo/t/<nfc_code>
   ```

3. Log in if prompted.
4. Confirm the quest completion screen appears and stays visible until `Return to Board` is pressed.
5. Open the same URL again immediately and confirm it shows the duplicate cooldown state.

Dev test:

1. Start backend:

   ```bash
   cd backend
   uv run python main.py
   ```

2. Start frontend:

   ```bash
   cd frontend
   bun run dev
   ```

3. Open:

   ```text
   http://majordomo:3000/t/<nfc_code>
   ```

The Vite config allows the `majordomo` host for this flow.

## Testing With NFC Hardware

1. Confirm the phone is connected to Tailscale and can open `http://majordomo`.
2. Open the app once and log in on the phone.
3. Write the production trigger URL to the NFC tag.
4. Scan the tag.
5. Confirm completion rewards.
6. Scan again immediately and confirm no second reward is awarded.

## Operational Notes

- The production Docker deployment should keep `VITE_API_URL=/api`.
- The backend is only exposed on `127.0.0.1:8000`; Caddy handles browser access through `/api`.
- Tailscale hostname resolution must make `majordomo` resolve on the scanning device.
- NFC rewards now use the same completion logic as board completion: bounty, corruption/shield, XP boost, participant reward rows, and achievements stay aligned.
