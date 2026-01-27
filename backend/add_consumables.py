#!/usr/bin/env python3
"""
Script to add Heroic Elixir and Purification Shield consumables to the database.
Run this from the backend directory: uv run python add_consumables.py
"""

import sys
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import get_db
from app.crud import reward as crud_reward
from app.crud import home as crud_home
from app.models.reward import RewardCreate


def add_consumables():
    """Add the two consumables to all homes in the database"""
    db = next(get_db())

    try:
        # Get all homes
        homes = crud_home.get_all_homes(db)

        if not homes:
            print("❌ No homes found in database. Create a home first.")
            return

        print(f"Found {len(homes)} home(s)")

        for home in homes:
            print(f"\n🏠 Adding consumables to home: {home.name} (ID: {home.id})")

            # Check if consumables already exist
            existing_rewards = crud_reward.get_home_rewards(db, home.id)
            existing_names = {r.name for r in existing_rewards}

            # Heroic Elixir
            if "Heroic Elixir" not in existing_names:
                elixir = RewardCreate(
                    name="Heroic Elixir",
                    description="Double XP for your next 3 completed quests",
                    cost=150
                )
                created_elixir = crud_reward.create_reward(db, home.id, elixir)
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
                created_shield = crud_reward.create_reward(db, home.id, shield)
                print(f"  ✅ Created Purification Shield (ID: {created_shield.id})")
            else:
                print(f"  ⏭️  Purification Shield already exists")

        print("\n✨ Done! You can now purchase consumables from the Market page.")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    add_consumables()
