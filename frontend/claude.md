# Frontend - React Application

React 19 application with Vite, providing a gamified interface for the Majordomo quest system.

## Tech Stack

- **Framework**: React 19 with hooks
- **Build Tool**: Vite (fast dev server, HMR)
- **Package Manager**: Bun (fast installs, runs)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + custom fantasy theme
- **Animations**: Framer Motion (motion components)
- **Routing**: React Router v7
- **HTTP Client**: Fetch API (via `services/api.ts`)

## Entry Point

`src/main.jsx` - Renders `<App />` into `#root`

## Structure

```
src/
├── App.jsx           # Root component with routing
├── main.jsx          # Entry point
├── index.css         # Global Tailwind imports
├── pages/            # Route components
├── components/       # Reusable UI components
├── services/         # API client
├── constants/        # Static data (colors, sample quests)
└── assets/           # Images (steward.png)
```

## Pages (`src/pages/`)

Main route components (React Router):

- **Board.jsx**: `/` - Quest board, main view showing active quests, create/edit quest modals
- **Heroes.jsx**: `/heroes` - Character/user profiles view
- **Profile.jsx**: `/profile` - Current user profile and settings
- **Market.jsx**: `/market` - Reward marketplace for spending gold
- **NFCTrigger.jsx**: `/nfc` - NFC tag interaction page

## Components (`src/components/`)

Reusable UI components:

- **Login.jsx**: Authentication form (email/password), handles register/login flow
- **QuestCard.jsx**: Individual quest display card with complete button
- **CreateQuestForm.jsx**: Modal for creating new quests with AI description generation toggle
- **EditQuestModal.jsx**: Modal for editing existing quests
- **HeroStatusBar.jsx**: Character status display (gold, XP, level)
- **BottomNav.jsx**: Bottom navigation bar for mobile navigation
- **TypeWriter.jsx**: Text animation component (typing effect)
- **ParchmentTypeWriter.jsx**: Fantasy-themed typewriter animation on parchment background

## Routing (`App.jsx`)

```jsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Board />} />
    <Route path="/heroes" element={<Heroes />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/market" element={<Market />} />
    <Route path="/nfc" element={<NFCTrigger />} />
  </Routes>
</BrowserRouter>
```

Protected routes check for JWT token in localStorage.

## API Client (`src/services/api.js`)

Centralized API communication with backend:

**Configuration**:
- Base URL: `http://localhost:8000/api`
- JWT token stored in `localStorage.getItem('token')`
- Auto-attaches `Authorization: Bearer <token>` header

**Methods**:
- `login(email, password)` - POST `/auth/login`
- `register(email, password, username)` - POST `/auth/register`
- `getQuests()` - GET `/quests/`
- `createQuest(questData)` - POST `/quests/`
- `updateQuest(questId, questData)` - PUT `/quests/{id}`
- `deleteQuest(questId)` - DELETE `/quests/{id}`
- `completeQuest(questId)` - POST `/quests/{id}/complete`
- `getBounties()` - GET `/bounties/`
- `claimBounty(bountyId)` - POST `/bounties/{id}/claim`
- `getRewards()` - GET `/rewards/`
- `purchaseReward(rewardId)` - POST `/rewards/{id}/purchase`
- `getCurrentUser()` - GET `/users/me`
- `generateQuestDescription(title)` - POST `/scribe/generate` (Groq AI)

## State Management

- **Local component state**: `useState` hooks
- **Auth state**: JWT token in localStorage, user object in component state
- **No global state library** (Redux, Zustand, etc.)
- **Data fetching**: useEffect hooks with fetch calls

## Styling Approach

- **Tailwind CSS**: Utility-first classes
- **Custom theme**: Fantasy/medieval aesthetic with parchment, warm colors
- **Responsive**: Mobile-first with bottom navigation
- **Animations**: Framer Motion for transitions, typewriter effects

## Key Features

1. **Quest Creation**: Modal with optional AI-generated descriptions (Groq)
2. **Quest Editing**: Modal with pre-filled data
3. **Quest Completion**: Click to complete, awards gold/XP
4. **Daily Bounties**: Time-limited quests with countdown timers
5. **Marketplace**: Browse and purchase rewards with earned gold
6. **NFC Integration**: Trigger actions via NFC tags
7. **Authentication**: Login/register with JWT persistence

## Constants (`src/constants/`)

- **colors.js**: Color palette for difficulty levels, UI themes
- **sampleQuests.js**: Mock quest data for development/testing

## Authentication Flow

1. User enters email/password in Login.jsx
2. Call `api.login()` or `api.register()`
3. Store JWT token in localStorage
4. Store user object in component state
5. Attach token to all subsequent requests
6. Redirect to Board page on success

## Dev Commands

```bash
bun install      # Install dependencies
bun run dev      # Start Vite dev server (port 3000)
bun run build    # Production build (with TypeScript compilation)
bun run preview  # Preview production build
```

## Code Quality

**Linting & Formatting**:
```bash
bun run lint           # ESLint check
bun run format         # Format with Prettier
bun run format:check   # Check formatting
bun run typecheck      # TypeScript type check (no emit)
```

- **ESLint**: Configured in `eslint.config.js` with React hooks and Vite optimizations
- **Prettier**: Configured in `.prettierrc` for consistent code formatting

## Key Patterns

- Functional components with hooks (no class components)
- Controlled forms with onChange handlers
- Modal management with conditional rendering
- Token-based auth with localStorage persistence
- Optimistic UI updates (complete quest immediately, then call API)
