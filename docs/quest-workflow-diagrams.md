# Quest Template Workflow Diagrams

This document visualizes how quest templates spawn quest instances across different implementation phases.

## Current Workflow (Before Phase 1)

```mermaid
graph TD
    A[Create Quest Template] --> B{Recurrence Type?}
    B -->|one-off| C[Manual: User creates quest from template]
    B -->|daily/weekly/monthly| D[Automatic: Cron checks schedule]

    D --> E[For EACH user in home]
    E --> F[Create Quest Instance]
    F --> G[Quest references template.title]
    F --> H[Quest references template.xp_reward]

    C --> F

    I[User completes quest] --> J[Read template.xp_reward]
    J --> K[Apply multipliers]
    K --> L[Award XP/Gold]

    M[Edit Template] --> N[Changes affect ALL quests]
    N --> O[Active quests see new values]
    N --> P[Completed quest history changes!]

    style N fill:#f99
    style P fill:#f99
```

**Problems:**
- 🔴 Editing templates changes active quests
- 🔴 Quest history is not preserved (shows current template values)
- 🔴 Quests are not self-contained

---

## After Phase 1: Snapshot Pattern

```mermaid
graph TD
    A[Create Quest Template] --> B{Recurrence Type?}
    B -->|one-off| C[Manual: User creates quest from template]
    B -->|daily/weekly/monthly| D[Automatic: Cron checks schedule]

    D --> E[For EACH user in home]
    E --> F[Create Quest Instance]

    C --> F

    F --> G[SNAPSHOT: Copy title to quest]
    F --> H[SNAPSHOT: Copy xp_reward to quest]
    F --> I[SNAPSHOT: Copy description, tags, etc]

    J[User completes quest] --> K[Read quest.xp_reward base]
    K --> L[Apply multipliers dynamically]
    L --> M[Update quest.xp_reward to final amount]
    M --> N[Award XP/Gold to user]

    O[Edit Template] --> P[Only affects NEW quests]
    P --> Q[Active quests unchanged ✓]
    P --> R[Completed quest history preserved ✓]

    style Q fill:#9f9
    style R fill:#9f9

    S[Quest Template] -.reference only.-> T[Quest]
    T -.stores own data.-> U[Self-contained]
```

**Benefits:**
- ✅ Quests are self-contained and independent of template changes
- ✅ Rewards use dynamic multiplier pattern (base → completion)
- ✅ Quest history is preserved
- ✅ Supports standalone quests (nullable template_id)

**Status:** ✅ **IMPLEMENTED** (awaiting migration)

---

## After Phase 3: Per-User Scheduling

```mermaid
graph TD
    A[Create Quest Template] --> B[Template = Blueprint Only]
    B --> C[No schedule on template]

    D[User A subscribes to template] --> E[UserTemplateSubscription A]
    E --> F[Schedule: Daily 8am]
    E --> G[due_in_hours: 24]

    H[User B subscribes to same template] --> I[UserTemplateSubscription B]
    I --> J[Schedule: Weekly Monday]
    I --> K[due_in_hours: 72]

    L[Cron runs] --> M{Check User A subscription}
    M -->|Time matches| N[Create Quest for User A]
    N --> O[SNAPSHOT template data]
    O --> P[Quest for User A with 24h deadline]

    L --> Q{Check User B subscription}
    Q -->|Time matches| R[Create Quest for User B]
    R --> S[SNAPSHOT template data]
    S --> T[Quest for User B with 72h deadline]

    U[User A completes quest] --> V[Dynamic multipliers applied]
    W[User B completes quest] --> X[Dynamic multipliers applied]

    Y[Edit Template] --> Z[Only affects NEW quests]
    Z --> AA[User A's active quest unchanged]
    Z --> AB[User B's active quest unchanged]

    AC[User A pauses subscription] --> AD[Only User A stops receiving]
    AE[User B keeps receiving]

    style P fill:#9f9
    style T fill:#9f9
    style AD fill:#9cf
```

**Additional Benefits:**
- ✅ Per-user scheduling (User A: daily, User B: weekly for same template)
- ✅ Individual pause/resume controls
- ✅ Private templates (visible only to creator)
- ✅ Flexible due date configuration per user

**Status:** ⏳ **NOT STARTED** (requires new model: UserTemplateSubscription)

---

## Comparison Table

| Aspect | Current | After Phase 1 | After Phase 3 |
|--------|---------|---------------|---------------|
| **Quest data source** | Live template reference | Snapshot at creation | Snapshot at creation |
| **Template edits affect active quests?** | ❌ Yes | ✅ No | ✅ No |
| **Schedule location** | On template (home-wide) | On template (home-wide) | Per-user subscription |
| **Per-user schedules** | ❌ No | ❌ No | ✅ Yes |
| **Private templates** | ❌ No | ❌ No | ✅ Yes |
| **Standalone quests** | ❌ No (needs dummy template) | ✅ Yes (nullable template_id) | ✅ Yes |
| **Quest history preserved** | ❌ No | ✅ Yes | ✅ Yes |
| **Dynamic multipliers** | ❌ No | ✅ Yes | ✅ Yes |

---

## Implementation Phases

### Phase 1: Snapshot Pattern ✅ DONE
- [x] Add snapshot fields to Quest model
- [x] Make quest_template_id nullable
- [x] Update quest creation to snapshot template data
- [x] Remove xp_awarded/gold_awarded (use xp_reward/gold_reward)
- [x] Frontend uses quest snapshot fields
- [x] All tests passing (146/146)
- [ ] Run migration in production

### Phase 2: Standalone Quests
- [ ] Add standalone quest creation endpoint
- [ ] Add UI for creating quests without templates
- [ ] Support orphaned quests (template deleted)

### Phase 3: Per-User Scheduling
- [ ] Create UserTemplateSubscription model
- [ ] Migrate existing schedules to subscriptions
- [ ] Update generation logic
- [ ] Add subscription management UI
- [ ] Support template visibility (private/shared)

### Phase 4: Additional Features
- [ ] Bulk subscription management
- [ ] Template marketplace/sharing
- [ ] Advanced scheduling (bi-weekly, custom patterns)
- [ ] Quest templates versioning

---

## Related Documents

- [Quest Template Refactoring Design](./plans/2026-01-29-quest-template-refactoring.md) - Full technical design
- [Quest System Notes](../QUEST_SYSTEM_NOTES.md) - Architecture overview
- [GitHub Issue #33](https://github.com/ini272/majordomo/issues/33) - Per-user scheduling request
