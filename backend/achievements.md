# Achievement System Documentation

## Overview

The achievement system provides a way to reward users with badges/milestones for completing various tasks and reaching certain goals in the Majordomo app. Achievements are automatically checked and awarded when users complete quests or reach specific criteria.

## 📊 Database Schema

```
┌─────────────────────────┐
│       Home              │
│─────────────────────────│
│ id                      │
│ name                    │
│ invite_code             │
└────────┬────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────┐         ┌──────────────────────────┐
│    Achievement          │         │         User             │
│─────────────────────────│         │──────────────────────────│
│ id                      │         │ id                       │
│ home_id        (FK)     │         │ home_id         (FK)     │
│ name                    │         │ username                 │
│ description             │         │ level                    │
│ criteria_type           │         │ xp                       │
│ criteria_value          │         │ gold_balance             │
│ icon                    │         └────────┬─────────────────┘
│ created_at              │                  │
└────────┬────────────────┘                  │
         │                                   │
         │                 N:M               │
         │           ┌───────────────────────┘
         │           │
         └───────────┼──────────┐
                     ▼          │
         ┌──────────────────────┴──────┐
         │   UserAchievement           │
         │─────────────────────────────│
         │ id                          │
         │ user_id            (FK)     │
         │ achievement_id     (FK)     │
         │ unlocked_at                 │
         └─────────────────────────────┘
```

## 🎯 Achievement Criteria Types

The system supports multiple criteria types for unlocking achievements:

| Criteria Type        | Description                           | Checks Against        |
|---------------------|---------------------------------------|-----------------------|
| `quests_completed`  | Complete X total quests               | Quest count (completed=true) |
| `level_reached`     | Reach character level X               | User.level            |
| `xp_earned`         | Earn X total experience points        | User.xp               |
| `gold_earned`       | Have X gold in balance                | User.gold_balance     |
| `bounties_completed`| Complete X bounty quests              | Bounty quest count    |

## 🔄 Achievement Workflow

### 1. Creating an Achievement

```
POST /api/achievements
───────────────────────────────────────────────
{
  "name": "Quest Novice",
  "description": "Complete your first 10 quests",
  "criteria_type": "quests_completed",
  "criteria_value": 10,
  "icon": "quest_badge"
}
───────────────────────────────────────────────
                   │
                   ▼
         ┌─────────────────────┐
         │ Achievement created │
         │ in home database    │
         └─────────────────────┘
```

### 2. Quest Completion Flow (Auto-Award)

```
User completes quest
         │
         ▼
┌─────────────────────────┐
│ POST /api/quests/{id}   │
│        /complete        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ Quest marked complete                   │
│ XP & Gold awarded to user               │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ check_and_award_achievements()          │
│                                         │
│ For each achievement in home:           │
│  1. Check if user already has it        │
│  2. Check if criteria is met:           │
│     - quests_completed? Count quests    │
│     - level_reached? Check user.level   │
│     - xp_earned? Check user.xp          │
│     - gold_earned? Check user.gold      │
│     - bounties? Count bounty quests     │
│  3. If met && not owned → AWARD!        │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ Response includes:                      │
│ {                                       │
│   "quest": {...},                       │
│   "rewards": {xp, gold, ...},           │
│   "achievements": [                     │
│     {id: 1, unlocked_at: "..."},       │
│     {id: 3, unlocked_at: "..."}        │
│   ]                                     │
│ }                                       │
└─────────────────────────────────────────┘
```

### 3. Manual Achievement Check

```
POST /api/achievements/users/{user_id}/check
───────────────────────────────────────────────
                   │
                   ▼
         ┌─────────────────────┐
         │ Check all criteria  │
         │ Award if met        │
         └─────────┬───────────┘
                   │
                   ▼
         Returns newly awarded achievements
```

### 4. Retrieving User Achievements

```
GET /api/achievements/me/achievements
───────────────────────────────────────────────
                   │
                   ▼
┌──────────────────────────────────────────────┐
│ Returns array of unlocked achievements:      │
│ [                                            │
│   {                                          │
│     "id": 1,                                 │
│     "user_id": 5,                            │
│     "achievement_id": 3,                     │
│     "unlocked_at": "2026-01-12T10:30:00Z",   │
│     "achievement": {                         │
│       "id": 3,                               │
│       "name": "Quest Novice",                │
│       "description": "Complete 10 quests",   │
│       "criteria_type": "quests_completed",   │
│       "criteria_value": 10,                  │
│       "icon": "quest_badge"                  │
│     }                                        │
│   }                                          │
│ ]                                            │
└──────────────────────────────────────────────┘
```

## 📡 Complete API Reference

### GET Endpoints

| Endpoint | Description | Response |
|----------|-------------|----------|
| `GET /api/achievements` | List all achievements in home | `AchievementRead[]` |
| `GET /api/achievements/{id}` | Get specific achievement | `AchievementRead` |
| `GET /api/achievements/users/{user_id}/achievements` | Get user's unlocked achievements | `UserAchievementWithDetails[]` |
| `GET /api/achievements/me/achievements` | Get current user's achievements | `UserAchievementWithDetails[]` |

### POST Endpoints

| Endpoint | Description | Request Body | Response |
|----------|-------------|--------------|----------|
| `POST /api/achievements` | Create new achievement | `AchievementCreate` | `AchievementRead` |
| `POST /api/achievements/{achievement_id}/award/{user_id}` | Manually award achievement | - | `UserAchievementRead` |
| `POST /api/achievements/users/{user_id}/check` | Check and auto-award achievements | - | `UserAchievementRead[]` |

### DELETE Endpoints

| Endpoint | Description | Response |
|----------|-------------|----------|
| `DELETE /api/achievements/{id}` | Delete achievement | `{"detail": "Achievement deleted"}` |

## 💻 Code Examples

### Example 1: Creating an Achievement

```python
import requests

# Create "First Quest" achievement
response = requests.post(
    "http://localhost:8000/api/achievements",
    json={
        "name": "First Steps",
        "description": "Complete your very first quest!",
        "criteria_type": "quests_completed",
        "criteria_value": 1,
        "icon": "🎯"
    },
    headers={"Authorization": f"Bearer {token}"}
)

achievement = response.json()
print(f"Created achievement: {achievement['name']} (ID: {achievement['id']})")
```

### Example 2: Creating Multiple Achievement Milestones

```python
milestones = [
    {"name": "Quest Novice", "criteria_value": 10},
    {"name": "Quest Apprentice", "criteria_value": 25},
    {"name": "Quest Expert", "criteria_value": 50},
    {"name": "Quest Master", "criteria_value": 100},
    {"name": "Quest Legend", "criteria_value": 250},
]

for milestone in milestones:
    requests.post(
        "http://localhost:8000/api/achievements",
        json={
            "name": milestone["name"],
            "description": f"Complete {milestone['criteria_value']} quests",
            "criteria_type": "quests_completed",
            "criteria_value": milestone["criteria_value"],
        },
        headers={"Authorization": f"Bearer {token}"}
    )
```

### Example 3: Frontend - Displaying Achievement Unlock

```typescript
// After completing a quest
const completeQuest = async (questId: number) => {
  const response = await fetch(`/api/quests/${questId}/complete`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await response.json();

  // Show XP/Gold rewards
  console.log(`Earned ${data.rewards.xp} XP and ${data.rewards.gold} gold!`);

  // Show achievement notifications
  if (data.achievements && data.achievements.length > 0) {
    data.achievements.forEach(achievement => {
      showAchievementToast({
        id: achievement.id,
        message: "🎉 Achievement Unlocked!",
        timestamp: achievement.unlocked_at
      });
    });
  }
};
```

### Example 4: CRUD Operations (Python)

```python
from sqlmodel import Session
from app.crud import achievement as crud_achievement
from app.models.achievement import AchievementCreate

# Create
new_achievement = AchievementCreate(
    name="Gold Hoarder",
    description="Accumulate 1000 gold",
    criteria_type="gold_earned",
    criteria_value=1000,
    icon="💰"
)
achievement = crud_achievement.create_achievement(db, home_id=1, achievement_in=new_achievement)

# Read
all_achievements = crud_achievement.get_home_achievements(db, home_id=1)
user_achievements = crud_achievement.get_user_achievements(db, user_id=5)

# Award
awarded = crud_achievement.award_achievement(db, user_id=5, achievement_id=achievement.id)

# Check if user has achievement
has_it = crud_achievement.has_user_achievement(db, user_id=5, achievement_id=achievement.id)

# Auto-check and award
newly_awarded = crud_achievement.check_and_award_achievements(db, user_id=5)
print(f"Awarded {len(newly_awarded)} new achievements!")

# Delete
success = crud_achievement.delete_achievement(db, achievement_id=achievement.id)
```

## 🎮 Sample Achievement Ideas

Here are some pre-built achievement ideas you can create:

### Quest-Based
- **First Steps** - Complete 1 quest (`quests_completed: 1`)
- **Getting Started** - Complete 5 quests (`quests_completed: 5`)
- **Quest Novice** - Complete 10 quests (`quests_completed: 10`)
- **Quest Apprentice** - Complete 25 quests (`quests_completed: 25`)
- **Quest Expert** - Complete 50 quests (`quests_completed: 50`)
- **Quest Master** - Complete 100 quests (`quests_completed: 100`)

### Level-Based
- **Level Up** - Reach level 2 (`level_reached: 2`)
- **Seasoned Hero** - Reach level 5 (`level_reached: 5`)
- **Veteran** - Reach level 10 (`level_reached: 10`)
- **Elite** - Reach level 20 (`level_reached: 20`)

### Bounty-Based
- **Bounty Hunter** - Complete 1 bounty (`bounties_completed: 1`)
- **Bounty Specialist** - Complete 10 bounties (`bounties_completed: 10`)
- **Bounty Legend** - Complete 50 bounties (`bounties_completed: 50`)

### Wealth-Based
- **First Coins** - Earn 100 gold (`gold_earned: 100`)
- **Gold Collector** - Earn 500 gold (`gold_earned: 500`)
- **Wealthy** - Earn 1000 gold (`gold_earned: 1000`)
- **Gold Hoarder** - Earn 5000 gold (`gold_earned: 5000`)

### XP-Based
- **XP Beginner** - Earn 100 XP (`xp_earned: 100`)
- **XP Grinder** - Earn 1000 XP (`xp_earned: 1000`)
- **XP Master** - Earn 5000 XP (`xp_earned: 5000`)

## 🔍 How Criteria Checking Works

```python
def check_and_award_achievements(db: Session, user_id: int) -> List[UserAchievement]:
    """
    Automatically checks if user meets criteria for any achievements
    and awards them if they do.
    """
    user = get_user(db, user_id)
    home_achievements = get_home_achievements(db, user.home_id)

    newly_awarded = []

    for achievement in home_achievements:
        # Skip if already earned
        if has_user_achievement(db, user_id, achievement.id):
            continue

        meets_criteria = False

        # Check each criteria type
        if achievement.criteria_type == "quests_completed":
            count = get_user_quests_completed_count(db, user_id)
            meets_criteria = count >= achievement.criteria_value

        elif achievement.criteria_type == "level_reached":
            meets_criteria = user.level >= achievement.criteria_value

        elif achievement.criteria_type == "gold_earned":
            meets_criteria = user.gold_balance >= achievement.criteria_value

        elif achievement.criteria_type == "xp_earned":
            meets_criteria = user.xp >= achievement.criteria_value

        elif achievement.criteria_type == "bounties_completed":
            count = get_user_bounties_completed_count(db, user_id)
            meets_criteria = count >= achievement.criteria_value

        # Award if criteria met
        if meets_criteria:
            awarded = award_achievement(db, user_id, achievement.id)
            if awarded:
                newly_awarded.append(awarded)

    return newly_awarded
```

## 🚀 Integration Points

The achievement system integrates with existing systems:

### Quest Completion
- **File**: `backend/app/routes/quest.py`
- **Function**: `complete_quest()`
- **Integration**: Automatically calls `check_and_award_achievements()` after awarding XP/gold

### User Stats
- **Files**: `backend/app/models/user.py`, `backend/app/crud/user.py`
- **Integration**: Achievement criteria check user's level, xp, and gold_balance

### Home Scoping
- **File**: `backend/app/models/home.py`
- **Integration**: Achievements belong to homes; users can only earn achievements from their home

## 📝 Response Schemas

### AchievementRead
```typescript
{
  id: number;
  home_id: number;
  name: string;
  description: string | null;
  criteria_type: string;
  criteria_value: number;
  icon: string | null;
  created_at: string; // ISO 8601 datetime
}
```

### UserAchievementWithDetails
```typescript
{
  id: number;
  user_id: number;
  achievement_id: number;
  unlocked_at: string; // ISO 8601 datetime
  achievement: {
    id: number;
    name: string;
    description: string | null;
    criteria_type: string;
    criteria_value: number;
    icon: string | null;
    created_at: string;
  }
}
```

## 🛠️ Files Modified/Created

### New Files
- `backend/app/models/achievement.py` - Achievement models
- `backend/app/crud/achievement.py` - CRUD operations
- `backend/app/routes/achievement.py` - API endpoints

### Modified Files
- `backend/app/models/user.py` - Added `user_achievements` relationship
- `backend/app/models/home.py` - Added `achievements` relationship
- `backend/app/routes/quest.py` - Added achievement checking on quest completion
- `backend/app/main.py` - Registered achievement router
- `backend/app/models/__init__.py` - Exported Achievement models
- `backend/app/crud/__init__.py` - Exported achievement CRUD

## 🎯 Testing Checklist

- [ ] Create achievement via API
- [ ] Complete quest that meets achievement criteria
- [ ] Verify achievement is auto-awarded
- [ ] Fetch user achievements via API
- [ ] Verify achievement appears in response
- [ ] Try to award same achievement twice (should fail)
- [ ] Delete achievement via API
- [ ] Create achievements with all criteria types
- [ ] Test manual award endpoint
- [ ] Test check endpoint

## 🔮 Future Enhancements

Potential additions to the achievement system:

1. **Streak Achievements** - Complete quests X days in a row
2. **Category-Specific** - Complete X quests of a specific type
3. **Time-Based** - Complete a quest within X minutes
4. **Secret Achievements** - Hidden until unlocked
5. **Tiered Achievements** - Bronze/Silver/Gold tiers
6. **Achievement Points** - Different achievements worth different points
7. **Leaderboard Integration** - Rank users by achievement count/points
8. **Notification System** - Real-time achievement unlock notifications
9. **Achievement Rewards** - Grant bonus XP/gold when unlocked
10. **Social Features** - Share achievements with other home members

---

**Questions or Issues?** Check the API documentation at `/docs` when running the backend server.
