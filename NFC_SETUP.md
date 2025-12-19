# NFC Trigger Setup Guide

## Overview
NFC tags are simple triggers that link to quest completion. When scanned, they automatically complete a quest template and award XP/Gold to the authenticated user.

## Backend
- **Endpoint:** `POST /api/triggers/quest/{quest_template_id}`
- **Authentication:** Required (JWT Bearer token)
- **Response:** Quest completion details + rewards + updated user stats

## Frontend
- **Route:** `/trigger/quest/:questTemplateId`
- **Auth Handling:** Automatically redirects to login if not authenticated
- **Post-Login Flow:** Redirects back to trigger URL and completes quest
- **UX:** Shows completion animation, rewards display, auto-returns to board in 3 seconds

## NFC Tag Configuration

### What to Write
Write a URI record to your NFC tag with the following format:

```
https://<your-lan-ip>:3000/trigger/quest/<quest_template_id>
```

**Examples:**
- If your laptop IP is `192.168.1.100`: `https://192.168.1.100:3000/trigger/quest/1`
- If using mDNS: `https://grindstone.local:3000/trigger/quest/1`

### How to Write the Tag
1. Use an NFC writing app on your phone (e.g., TagWriter by NXP, Trigger)
2. Create a new URI record
3. Paste the URL above
4. Write to your NFC tag
5. Test by scanning

## Quest Template IDs
Reference seeded templates (from seed.py):
- `1`: Clean Kitchen (Standard)
- `2`: Do Laundry (Standard)
- `3`: Vacuum Living Room (Corrupted)
- `4`: Walk the Dog (Bounty)
- `5`: Mow Lawn (Bounty)
- `6`: Take out Trash (Corrupted)

Create more templates via the API and note their IDs for new tags.

## Testing Flow

### Without NFC Hardware
1. Start both servers:
   ```bash
   cd backend && python main.py
   cd frontend && npm run dev
   ```

2. Manually open the trigger URL:
   ```
   http://localhost:3000/trigger/quest/1
   ```

3. Login with seeded credentials:
   - Username: `alice`, `bob`, or `charlie`
   - Password: `alice123`, `bob123`, `charlie123`
   - Home ID: `1`

4. Quest completes and shows rewards

### With NFC Hardware
1. Ensure servers running on `0.0.0.0:8000` and `localhost:3000`
2. Phone on same LAN as laptop
3. Open browser, navigate to `http://<your-laptop-ip>:3000`, login
4. Scan NFC tag with phone
5. App triggers quest completion
6. See animation + rewards
7. Auto-return to board

## Server Configuration
To allow phone access over LAN:

**Backend:** Already configured for `0.0.0.0:8000` in `backend/main.py`

**Frontend:** 
- Dev server binds to all interfaces automatically
- Access via `http://<your-ip>:3000` from any device on LAN

## Quest Type System
Each quest instance inherits `quest_type` from its template:
- `standard`: Normal quest (gold borders)
- `bounty`: Higher value quest (purple borders)
- `corrupted`: Urgent/overdue quest (red borders)

Types are for visual distinction and future mechanic variation.

## Future Enhancements
- **Zone Mappings**: Map physical locations to quest templates (rotate which quest a zone points to)
- **Cooldown**: Prevent scanning same tag multiple times in short window
- **Activity Log**: Track all NFC scans per user/zone
- **Analytics**: Dashboard showing which zones are scanned most
