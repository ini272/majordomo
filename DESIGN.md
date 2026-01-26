# Majordomo: The Gamified Chore Quest System

A self-hosted, fantasy-themed RPG designed to re-enchant the mundane tasks of daily household life. This system transforms chores into quests, progression into levels, and a home into a realm of adventure.

## I. The Core Vision: Re-enchanting the Mundane

The fundamental goal is to transform monotonous household chores into an engaging, fantasy-themed RPG. The project leans on the "cozy effect" of fantasy settings to combat the ambiguity and monotony of daily life.

The modern world is efficient but often "disenchanted." This project battles the monotony by providing:

-   **A Sense of Purpose:** By framing chores as "quests," we give them narrative significance. The kitchen is no longer just a kitchen; it is **"The Forge."** Taking out the trash is not a chore; it is **"Defeating the Trash Elemental."**
-   **Moral Clarity:** A quest has an unambiguously good outcome. This provides a restful escape from the complex moral calculus of the real world.
-   **Agency and Progression:** Users are not just completing tasks; they are Heroes on a journey. Their actions have a direct, measurable impact, visualized through XP, levels, and tangible rewards.

## I.B. Design Constraints & Core Values

The following principles guide all design and engineering decisions:

-   **Mobile-First:** The app is designed for phones first, tablets second, desktop third. Touch interactions and responsive layouts are foundational, not afterthoughts.
-   **Self-Hosted Simplicity:** The system must run locally with minimal infrastructure. SQLite + FastAPI on a single machine is the target. No cloud dependencies, no complex DevOps.
-   **Family-Friendly & Private:** All data remains on the home network. No external logins, no tracking, no ads. The app is safe for kids to use independently.
-   **Low Friction, High Engagement:** The user should be completing their first quest within 30 seconds of opening the app. No tutorials, no onboarding, no friction. The fantasy flavor does the heavy lifting.
-   **Incremental Complexity:** The MVP is deliberately simple. Advanced features (classes, boss quests, dynamic events) come later, once the core loop is proven.
-   **Ease of Use:** Quest creation should be effortless—use auto-generation, templates, quick-add buttons.
-   **Extendable & Modular:** System should support future expansions: new quest types, animations, gamification mechanics, integrations.
-   **Incremental AI Usage:** AI is a co-pilot, not a pilot. Use it for scaffolding, brainstorming, debugging, and generating flavor content.

## II. Core Gameplay Mechanics

The system is built on a foundation of proven RPG mechanics to ensure long-term engagement.

### 1. XP & The Leveling Curve
-   **Concept:** Players level up by gaining XP. The journey is designed to be rewarding, with a "WoW-Style" exponential curve. Early levels are fast to provide a hook, while later levels become epic achievements.
-   **Formula:** `XP_for_Next_Level = base_xp * (current_level ^ exponent)`
    -   *Recommended Values:* `base_xp = 100`, `exponent = 1.5`

### 2. Quest Rewards & Valuation
-   **Concept:** Not all quests are created equal. The XP reward for a quest is calculated based on three axes to ensure the system feels fair.
-   **Formula:** `Base_XP = (Time + Effort + Dread) * multiplier`
    -   **Time:** How long does it take? (Scale 1-5)
    -   **Effort:** How physically or mentally draining is it? (Scale 1-5)
    -   **Dread:** The subjective "ick" factor. How much do you hate doing it? (Scale 1-5)

### 3. Dynamic World Systems
-   **"World Events" (Alternating Rewards):** To make the world feel alive, special bonuses are available on certain days.
    -   *Simple:* "The Sunday Pilgrim's Progress" - Exercise quests are always worth more on Sundays.
    -   *Advanced:* A "Daily Bounty Board" that randomly selects 1-3 quest categories to receive a bonus for 24 hours.
-   **"Exhaustion" (Diminishing Returns):** To discourage grinding the easiest quest, rewards diminish for repeated completions within a short time frame (e.g., 24 hours).
    -   **Formula:** `Final_XP = Base_XP * (decay_factor ^ recent_completions)`
    -   *Recommended Value:* `decay_factor = 0.8`. This must be transparent in the UI.

### 4. Quest Attributes & Categorization
-   **Difficulty Level:** Quests are rated Easy, Medium, or Hard. This helps users choose appropriate challenges and provides a visual indicator of effort required. Difficulty may inform XP scaling and enable level-gating in future phases.
-   **Category/Tags:** Quests are tagged with categories (e.g., Chores, Learning, Exercise, Health, Organization). This enables filtering and organization on the board, and allows for streak challenges ("Complete 5 Exercise quests") and targeted rewards.
-   **Icon/Emoji:** Each quest displays a thematic icon or emoji for quick visual recognition and flavor. Icons are assigned per quest or per category to reinforce identity and make the board more visually engaging.

### 5. Advanced Gameplay Concepts
-   **The "Corruption" System (✅ Implemented):** Quests with due dates that are not completed by their deadline become "Corrupted." Each quest instance tracks its own `quest_type` (standard, bounty, corrupted) independently from its template. When a quest becomes overdue, its `quest_type` is changed to "corrupted" and a `corrupted_at` timestamp is recorded. Corrupted quests trigger a **house-wide debuff** where each corrupted quest applies a -5% penalty to XP and Gold rewards for ALL household members (stacks up to -50%). This creates household-wide accountability and urgency to clear overdue tasks. The Purification Shield consumable can temporarily suppress this debuff for 24 hours.
-   **Player Classes:** At a milestone level (e.g., Level 10), players can choose a Class (e.g., **Guardian, Forager, Berserker**) that provides passive XP bonuses to certain quest types, encouraging specialization and identity.
-   **Achievements & Titles:** A "Feats of Strength" system tracks long-term stats, unlocking cosmetic "Titles" that players can display next to their name (e.g., "Kitchen Scourge," "Bane of the Pungent").
-   **Boss Quests & Subtasks:** Large household challenges ("The Garage Dragon") can be broken into subtasks and completed collaboratively by multiple users. Progress tracking per subtask incentivizes teamwork and provides a sense of progression through larger endeavors.

### 6. Character Progression & Economy
-   **XP & Levels:** Users have profiles with an XP bar and a level. Completing quests grants XP, and leveling up can unlock new in-game abilities (e.g., "Quest Veto").
-   **Gold & Shop (✅ Implemented):** Quests also reward Gold, a currency used in a virtual shop to buy items:
    -   **Consumables (Loop 1):** Strategic single-use items that create recurring gold value and immediate gameplay impact:
        -   **Heroic Elixir (150g):** Next 3 completed quests grant 2x XP. Quest-count based (persists until 3 quests completed). Cannot stack.
        -   **Purification Shield (200g):** Suppresses household corruption debuff for 24 hours (real-time). Quests still remain corrupted but rewards aren't penalized. Cannot stack.
    -   **Cosmetics (Loop 2 - Future):** Permanent unlocks like app themes, avatars, and titles for long-term goals (500-2000g range).

### 7. Time-Based Events
-   **Daily Bounties:** Special time-limited quests with bonus rewards, flagged by the server.
-   **"Boss Fights":** Large, daunting chores (like "clean the garage") are framed as collaborative bosses with a high HP pool. Smaller sub-tasks deal "damage" to the boss, encouraging the whole household to team up for a large reward.

### 8. Social Features
-   **Hall of Heroes:** A weekly leaderboard tracking XP earned.
-   **Tavern Feed:** A live activity feed showing recent accomplishments.

## III. UI/UX Design: The Hero's Interface

The user interface is designed to feel like a game dashboard, not a to-do list.

-   **Main Screen ("The Quest Board"):** The app opens directly to a dashboard showing all available quests. Quests are visually distinguished (e.g., Standard, Daily Bounty, Corrupted). A "Hero Status Bar" at the top always shows Level, XP, and Gold.
-   **Bottom Tab Bar Navigation:** Main navigation is handled by a five-icon bottom tab bar for an intuitive, mobile-first experience.
    1.  **Board (📜):** The main Quest Board dashboard.
    2.  **Profile (👤):** A consolidated view of the player's `Character Sheet`, `Chronicle` (Quest History), and `Feats` (Achievements).
    3.  **Scan Glyph (SCAN):** The "Center Stage" action button. Styled uniquely, this instantly opens the NFC/camera scanner, emphasizing it as the core interactive feature.
    4.  **Market (💰):** The shop for spending Gold on in-game perks.
    5.  **Heroes (🏆):** The "Hall of Heroes" weekly leaderboard.
-   **Settings (⚙️):** Located unobtrusively within the Hero's Profile screen.

## IV. The "Magic" - Key Technical Features

These technical pillars are designed to create a seamless and magical user experience.

### NFC Integration ("Arcane Sigils")
Cheap NFC tags are programmed with a URL pointing to a zone (e.g., `https://majordomo.local/trigger/zone/kitchen`). Each physical location has a 1:1 zone mapping to a quest template, which can be rotated/updated without rewriting the tag. When scanned, the app triggers quest completion for the authenticated user, immediately awarding XP/Gold and providing visual feedback. This provides a tactile bridge between the real world and the game.

**Seamlessness:** Using iOS Shortcuts or Android's Tasker can make this an instant, one-tap action with no extra prompts.

### The Asynchronous Scribe (AI Descriptions)
A FastAPI `BackgroundTask` calls a free-tier LLM API (e.g., Google Gemini Pro, Groq) to pre-populate a database with witty, thematic quest descriptions. This provides endless variety without sacrificing speed at the moment of quest creation.

**Solution:** When a new type of chore is created (e.g., "clean bathroom"), a background task generates 5-10 creative descriptions and saves them to the database. Quest creation is instantaneous for the user (a simple database read), but the content is rich, varied, and AI-generated.

### Immersive Feedback (Sound & Animation)
The app will make heavy use of "juice" to feel satisfying.

-   **Sound:** A custom `useSound` hook will manage sound effects for quest completions, level-ups, UI clicks, and rewards. Play a triumphant fanfare upon quest completion. Sound must be triggered by user interaction (browser policies), and a global mute button is essential.
-   **Animation:** `Framer Motion` will be used for fluid layout animations, "springy" physics on modals, and other effects that make the UI feel alive. Animate layouts as quests are re-ordered/completed, create springy pop-up modals, and add elegant fade-in/out effects.

## V. Technology Stack

-   **Backend:**
    -   **Framework:** FastAPI (for speed and simplicity)
    -   **Database/ORM:** SQLModel (combines Pydantic validation with SQLAlchemy)
    -   **Database:** SQLite (self-contained, file-based, perfect for self-hosting)
    -   **Server:** Uvicorn
-   **Frontend:**
    -   **Framework:** React 19 (bootstrapped with Vite for fast development)
    -   **UI Library:** Tailwind CSS (for MVP simplicity), Mantine/Chakra UI considered for future
    -   **Animation:** Framer Motion
    -   **PWA:** Mobile install and offline support

**Architecture:** The front-end and back-end run as separate processes, connected via API calls. CORS middleware in FastAPI enables communication.

## VI. Development Phases

### MVP (Current) ✅ Complete
**Goal:** Validate the core gameplay loop. A user can log in, see quests, complete them, gain XP, and level up.

**Features:**
- User authentication (login/password per home)
- Quest Board displaying available quests
- Quest completion with XP/Gold rewards
- Hero Status Bar (Level, XP, Gold)
- Bottom Tab Navigation structure (Board functional, others as stubs)
- Quest type distinctions (Standard, Bounty, Corrupted)
- **Daily Bounty System:** Random quest template selected daily with 2x rewards
- **Gold Economy:** Consumable shop with Heroic Elixir (XP boost) and Purification Shield (debuff suppression)
- **Corruption System:** Overdue quests trigger house-wide -5% debuff per corrupted quest (capped at -50%)
- Responsive design (mobile + desktop)

### Phase 1
**Goal:** Flesh out the game world and player progression. Introduce filtering, quest metadata, and the Profile/Market pages.

**Features:**
- Difficulty levels and categories/tags on quests
- Quest filtering by category/difficulty
- Profile Page: Character Sheet, Quest History (Chronicle), Achievements (Feats)
- Market Page: Reward shop with Gold spending
- Heroes Page: Leaderboard (weekly/all-time)
- Settings panel (within Profile)
- Error boundaries and user-facing error handling
- Toast notifications for feedback

### Phase 2
**Goal:** Advanced mechanics and immersion. Boss quests, NFC, AI flavor text, sound/animation.

**Features:**
- Boss Quests with subtasks and collaborative completion
- NFC tag integration for location-based quests
- AI-generated quest descriptions (Asynchronous Scribe) - **Partially implemented**: Backend ready, frontend integration pending
- Sound effects and Framer Motion animations ("juice")
- ~~Corruption system (overdue quests degrade)~~ - ✅ **Implemented in MVP**
- Player Classes with specialization bonuses

### Future
**Goal:** Long-term engagement and household gamification.

**Features:**
- Dynamic World Events (Daily Bounty Board, category bonuses)
- Exhaustion system (diminishing returns on quest grinding)
- Achievements & cosmetic Titles
- Dungeon Master's Screen (admin panel)
- Advanced leaderboard mechanics (streaks, category rankings)
- Tavern Feed (activity feed)
- WebSockets for real-time updates
- Optional integrations: Home Assistant, Discord bot

## VII. Future Development Roadmap

-   **The Dungeon Master's Screen:** A password-protected admin panel for the app creator to manually grant rewards, review AI-generated content, and trigger world events.
-   **Household Co-op:** Implementing "Boss Fights" that require multiple users to complete sub-quests to defeat a large household challenge (e.g., "The Garage Dragon").
-   **Home Assistant Integration:** REST endpoints for event-based quest triggers (trash lid, dishwasher, motion sensors).
-   **Discord Bot:** Optional slash commands for quick quest interactions.
