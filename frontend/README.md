# Frontend

React + Vite client for Majordomo.

Last verified: 2026-02-15

## Run locally

```bash
bun install
bun run dev
```

Dev server: `http://localhost:3000`

## Cloudflare Dev (Auto Tunnels)

Start both quick tunnels and frontend dev server with one command:

```bash
bun run dev:cloudflare
```

What it does automatically:
- opens tunnel to `http://localhost:3000` for frontend
- opens tunnel to `http://localhost:8000` for backend
- waits for both `https://*.trycloudflare.com` URLs
- starts `bun run dev` with:
  - `HMR_HOST=<frontend tunnel host>`
  - `VITE_API_URL=<backend tunnel url>`

Prerequisite: backend API is already running locally on `http://localhost:8000`.

Optional overrides:

```bash
FRONTEND_PORT=3000 BACKEND_PORT=8000 bun run dev:cloudflare
```

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
- `VITE_API_URL` if set (auto-appends `/api` when missing)
- else browser host with port `8000` and `/api`

## Frontend Flow Diagrams

### Auth and session lifecycle

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f9f4e8', 'primaryBorderColor': '#8d6b4f', 'lineColor': '#8d6b4f', 'fontFamily': 'Georgia, serif' }}}%%
flowchart TD
  classDef action fill:#f9f4e8,stroke:#8d6b4f,color:#2d2117,stroke-width:1.2px;
  classDef state fill:#fffaf0,stroke:#b88c63,color:#2d2117,stroke-width:1px;
  classDef success fill:#eaf7ef,stroke:#3f8f5c,color:#18462b,stroke-width:1px;
  classDef warning fill:#fdf0e8,stroke:#c17652,color:#5a2f1a,stroke-width:1px;

  A[Login form submit] --> B[api.auth.*]
  B --> C[api.user.getStats]
  C --> D[useAuth.login]
  D --> E[AuthContext state]
  D --> F[session localStorage sync]
  E --> G{App auth gate}
  G -->|authenticated| H[Board, Profile, Market, NFC routes]
  G -->|not authenticated| I[Login screen]
  H --> J[logout]
  J --> K[AuthContext cleared + session.clear]

  class A,B,C,D action;
  class E,F,G state;
  class H,I success;
  class J,K warning;
```

### App request/data flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f9f4e8', 'primaryBorderColor': '#8d6b4f', 'lineColor': '#8d6b4f', 'fontFamily': 'Georgia, serif' }}}%%
flowchart LR
  classDef source fill:#eef4fb,stroke:#5f89b6,color:#1c3550,stroke-width:1.2px;
  classDef service fill:#fffaf0,stroke:#b88c63,color:#2d2117,stroke-width:1px;
  classDef backend fill:#eaf7ef,stroke:#3f8f5c,color:#18462b,stroke-width:1.2px;

  P[Page or component] --> Q[useAuth token/userId]
  P --> R[api service methods]
  Q --> R
  R --> S[Fetch /api/*]
  S --> T[Backend FastAPI]
  T --> S
  S --> U[Typed response or normalized error]
  U --> P

  class P,Q source;
  class R,S,U service;
  class T backend;
```

### Quest creation and edit flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f9f4e8', 'primaryBorderColor': '#8d6b4f', 'lineColor': '#8d6b4f', 'fontFamily': 'Georgia, serif' }}}%%
flowchart TD
  classDef input fill:#eef4fb,stroke:#5f89b6,color:#1c3550,stroke-width:1.2px;
  classDef branch fill:#f8efe0,stroke:#b88c63,color:#2d2117,stroke-width:1.2px;
  classDef action fill:#f9f4e8,stroke:#8d6b4f,color:#2d2117,stroke-width:1px;
  classDef done fill:#eaf7ef,stroke:#3f8f5c,color:#18462b,stroke-width:1.2px;

  A[Board opens CreateQuestForm] --> B{Mode}
  B -->|AI Scribe| C[api.quests.createAIScribe]
  B -->|From Template| D[api.quests.create]
  B -->|Random| E[EditQuestModal with initialData]
  C --> F[EditQuestModal]
  D --> G[Quest created]
  E --> F
  F --> H[api.quests.update or template/subscription APIs]
  H --> I[Refresh Board quests]

  class A input;
  class B branch;
  class C,D,E,F,H action;
  class G,I done;
```

### Recurrence/schedule flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f9f4e8', 'primaryBorderColor': '#8d6b4f', 'lineColor': '#8d6b4f', 'fontFamily': 'Georgia, serif' }}}%%
flowchart LR
  classDef form fill:#eef4fb,stroke:#5f89b6,color:#1c3550,stroke-width:1.2px;
  classDef compute fill:#f9f4e8,stroke:#8d6b4f,color:#2d2117,stroke-width:1px;
  classDef store fill:#fffaf0,stroke:#b88c63,color:#2d2117,stroke-width:1px;
  classDef output fill:#eaf7ef,stroke:#3f8f5c,color:#18462b,stroke-width:1.2px;

  A[EditQuestModal form fields] --> B[buildSchedule]
  B --> C[schedule JSON stored via API]
  C --> D[Quest/template/subscription data]
  D --> E[parseSchedule]
  E --> F[Edit defaults + UI controls]
  D --> G[formatScheduleLabel]
  G --> H[QuestCard recurring label]

  class A form;
  class B,E,G compute;
  class C,D store;
  class F,H output;
```

## Beautiful Mermaid (Optional SVG Export)

If you want richer static diagrams than markdown Mermaid rendering, use `beautiful-mermaid` to generate SVG:

```ts
import { renderMermaid, THEMES } from "beautiful-mermaid";

const svg = await renderMermaid(
  `flowchart TD; A[Login] --> B[Token issued] --> C[Board]`,
  THEMES["catppuccin-latte"]
);
```
