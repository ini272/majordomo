"""Seed the database with test data for UI development"""
from sqlmodel import Session, SQLModel

# Import all models FIRST to register them
from app.models.home import Home
from app.models.user import User
from app.models.quest import QuestTemplate, Quest
from app.models.reward import Reward, UserRewardClaim

# Now setup database
from app.database import engine

# Drop and recreate all tables
SQLModel.metadata.drop_all(engine)
SQLModel.metadata.create_all(engine)

# Now import CRUD functions
from app.crud import home as crud_home
from app.crud import user as crud_user
from app.crud import quest_template as crud_quest_template
from app.crud import quest as crud_quest
from app.crud import reward as crud_reward
from app.models.home import HomeCreate
from app.models.user import UserCreate
from app.models.quest import QuestTemplateCreate, QuestCreate
from app.models.reward import RewardCreate


def seed_database():
    """Populate database with test data"""
    
    with Session(engine) as session:
        # Create a home
        home_data = HomeCreate(name="The Martinez Family")
        home = crud_home.create_home(session, home_data)
        print(f"✓ Created home: {home.name}")
        
        # Create users (passwords: alice123, bob123, charlie123)
        users = []
        for username in ["alice", "bob", "charlie"]:
            user_data = UserCreate(username=username, password=f"{username}123")
            user = crud_user.create_user(session, home.id, user_data)
            users.append(user)
            print(f"  ✓ Created user: {user.username} (level {user.level})")
        
        alice, bob, charlie = users
        
        # Create quest templates
        templates = []
        quest_data = [
            ("Clean Kitchen", "Wash dishes and wipe counters", 25, 15),
            ("Do Laundry", "Wash, dry, and fold clothes", 30, 20),
            ("Vacuum Living Room", "Deep clean the living room", 20, 10),
            ("Walk the Dog", "Take Rex for a 30 minute walk", 15, 5),
            ("Mow Lawn", "Cut the grass and edge the driveway", 50, 30),
            ("Take out Trash", "Bins to curb, bring them back", 5, 2),
        ]
        
        quest_display_names = [
            "Slay the Grease Dragon",
            "Conquer the Textile Mountains",
            "Purify the Dust Realm",
            "Quest with the Noble Beast",
            "Tame the Grass Kingdom",
            "Vanquish the Trash Goblins",
        ]
        
        for i, (title, description, xp, gold) in enumerate(quest_data):
            template_in = QuestTemplateCreate(
                title=title,
                display_name=quest_display_names[i],
                description=description,
                xp_reward=xp,
                gold_reward=gold,
                recurrence="one-off"
            )
            template = crud_quest_template.create_quest_template(session, home.id, alice.id, template_in)
            templates.append(template)
            print(f"  ✓ Created template: {template.title} ({template.xp_reward} XP)")
        
        # Create quest instances (some completed, some active)
        quests_data = [
            (alice, templates[0], True),   # Alice completed cleaning
            (alice, templates[1], True),   # Alice completed laundry
            (alice, templates[2], False),  # Alice has vacuum pending
            (bob, templates[0], True),     # Bob completed cleaning
            (bob, templates[3], False),    # Bob has dog walk pending
            (bob, templates[4], False),    # Bob has mow lawn pending
            (charlie, templates[1], False),# Charlie has laundry pending
            (charlie, templates[5], True), # Charlie completed trash
        ]
        
        for user, template, completed in quests_data:
            quest_in = QuestCreate(quest_template_id=template.id)
            quest = crud_quest.create_quest(session, home.id, user.id, quest_in)
            
            if completed:
                quest = crud_quest.complete_quest(session, quest.id)
                # Award XP/gold
                user = crud_user.add_xp(session, user.id, template.xp_reward)
                user = crud_user.add_gold(session, user.id, template.gold_reward)
            
            status = "✓ completed" if completed else "⏳ pending"
            print(f"  ✓ {user.username} - {template.title} {status}")
        
        # Create rewards
        rewards = []
        reward_data = [
            ("1 Hour Gaming", "Guilt-free gaming for 60 minutes", 50),
            ("Movie Night", "Pick any movie to watch", 75),
            ("$10 Store Credit", "Spend on whatever you want", 100),
            ("Skip a Chore", "Get out of one chore of choice", 150),
            ("Pizza Night", "We order your favorite pizza", 200),
            ("Sleepover Permission", "Sleep over at a friend's house", 250),
        ]
        
        for name, description, cost in reward_data:
            reward_in = RewardCreate(
                name=name,
                description=description,
                cost=cost
            )
            reward = crud_reward.create_reward(session, home.id, reward_in)
            rewards.append(reward)
            print(f"  ✓ Created reward: {reward.name} ({reward.cost} gold)")
        
        # Have users claim some rewards
        crud_reward.claim_reward(session, alice.id, rewards[0].id)  # Alice claims gaming
        crud_reward.claim_reward(session, bob.id, rewards[1].id)    # Bob claims movie
        print(f"  ✓ Alice claimed: {rewards[0].name}")
        print(f"  ✓ Bob claimed: {rewards[1].name}")
        
        print("\n✅ Database seeded successfully!")
        print(f"\nQuick Stats:")
        print(f"  Home: {home.name}")
        print(f"  Users: {len(users)}")
        print(f"  Quest Templates: {len(templates)}")
        print(f"  Rewards: {len(rewards)}")


if __name__ == "__main__":
    seed_database()
