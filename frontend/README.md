# Frontend

React + Vite client for Majordomo.

Last verified: 2026-02-12

## Run locally

```bash
bun install
bun run dev
```

Dev server: `http://localhost:3000`

## Quality checks

```bash
bun run lint
bun run typecheck
bun run build
```

## App structure

- `src/App.tsx`: routing shell + auth gate
- `src/pages/Board.tsx`: current/upcoming quest views
- `src/pages/Profile.tsx`: user progression/status
- `src/pages/Market.tsx`: reward purchasing
- `src/pages/NFCTrigger.tsx`: trigger flow
- `src/components/`: UI building blocks and forms
- `src/services/api.ts`: backend API client
- `src/types/api.ts`: API types

## Routes

- `/board`
- `/profile`
- `/market`
- `/trigger/quest/:questTemplateId`
- `/playground` (UI/dev)

## API wiring

`src/services/api.ts` resolves base URL using:
- `VITE_API_URL` if set
- else browser host with port `8000` and `/api`
