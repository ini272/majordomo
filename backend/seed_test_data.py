#!/usr/bin/env python3
"""
Script to seed test data: home, user, consumables, and achievements.
Useful when recreating the database for testing.

Uses DATABASE_URL when set, otherwise seeds the repo-level data/majordomo.db.
Run this from the backend directory: uv run python seed_test_data.py
"""

import sys
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import get_db
from app.crud import achievement as crud_achievement
from app.crud import reward as crud_reward
from app.crud import home as crud_home
from app.crud import user as crud_user
from app.models.reward import RewardCreate
from app.models.home import HomeCreate
from app.models.user import UserCreate


def seed_test_data():
    """Seed test data: home, user, consumables, and achievements"""
    db = next(get_db())

    try:
        print("🌱 Seeding test data...\n")

        # ============================================
        # 1. CREATE TEST HOME
        # ============================================
        home_name = "The Dragons Den"
        existing_homes = crud_home.get_all_homes(db)
        test_home = next((h for h in existing_homes if h.name == home_name), None)

        if not test_home:
            print(f"🏠 Creating home: {home_name}")
            home_create = HomeCreate(name=home_name)
            test_home = crud_home.create_home(db, home_create)
            print(f"  ✅ Created home (ID: {test_home.id}, Invite: {test_home.invite_code})\n")
        else:
            print(f"🏠 Home '{home_name}' already exists (ID: {test_home.id})")
            print(f"  📋 Invite code: {test_home.invite_code}\n")

        # ============================================
        # 2. CREATE TEST USER
        # ============================================
        username = "dragon slayer"
        email = "dragonslayer@test.com"
        password = "dragon"  # Simple password for testing

        existing_user = crud_user.get_user_by_username(db, test_home.id, username)

        if not existing_user:
            print(f"👤 Creating user: {username}")
            user_create = UserCreate(
                username=username,
                email=email,
                password=password
            )
            test_user = crud_user.create_user(db, test_home.id, user_create)
            print(f"  ✅ Created user (ID: {test_user.id})")
            print(f"  📧 Email: {email}")
            print(f"  🔑 Password: {password}\n")
        else:
            print(f"👤 User '{username}' already exists (ID: {existing_user.id})")
            print(f"  📧 Email: {existing_user.email}")
            print(f"  🔑 Password: dragon (if unchanged)\n")

        # ============================================
        # 3. ADD CONSUMABLES
        # ============================================
        print(f"🛒 Adding consumables to '{test_home.name}'")

        existing_rewards = crud_reward.get_home_rewards(db, test_home.id)
        existing_names = {r.name for r in existing_rewards}

        # Heroic Elixir
        if "Heroic Elixir" not in existing_names:
            elixir = RewardCreate(
                name="Heroic Elixir",
                description="Double XP for your next 3 completed quests",
                cost=150
            )
            created_elixir = crud_reward.create_reward(db, test_home.id, elixir)
            print(f"  ✅ Created Heroic Elixir (ID: {created_elixir.id})")
        else:
            print(f"  ⏭️  Heroic Elixir already exists")

        # Purification Shield
        if "Purification Shield" not in existing_names:
            shield = RewardCreate(
                name="Purification Shield",
                description="Protect household from corruption debuff for 24h",
                cost=200
            )
            created_shield = crud_reward.create_reward(db, test_home.id, shield)
            print(f"  ✅ Created Purification Shield (ID: {created_shield.id})")
        else:
            print(f"  ⏭️  Purification Shield already exists")

        # ============================================
        # 4. ENSURE DEFAULT ACHIEVEMENTS
        # ============================================
        print("🏆 Ensuring default achievements exist")
        achievements = crud_achievement.create_default_achievements(db, test_home.id)
        print(f"  ✅ {len(achievements)} default achievement(s) available")

        # ============================================
        # SUMMARY
        # ============================================
        print("\n" + "="*60)
        print("✨ Test data seeded successfully!")
        print("="*60)
        print(f"\n🏠 Home: {test_home.name}")
        print(f"   Invite Code: {test_home.invite_code}")
        print(f"\n👤 Test User:")
        print(f"   Username: {username}")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        print(f"\n🏆 Default Achievements: {len(achievements)}")
        print(f"\n💡 You can now login at the frontend with these credentials!")
        print("="*60 + "\n")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    seed_test_data()
