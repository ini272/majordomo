import json
import time
from fastapi.testclient import TestClient

def test_ai_scribe_to_template_conversion_flow(client: TestClient, db_home_with_users):
    """Test complete AI Scribe → Edit → Convert to Template flow"""
    home, user, _user2 = db_home_with_users

    # Step 1: Create AI Scribe quest (standalone)
    quest_response = client.post(
        f"/api/quests/ai-scribe?user_id={user.id}&skip_ai=true",
        json={
            "title": "Clean kitchen",
            "tags": "chores,cleaning",
            "xp_reward": 25,
            "gold_reward": 15,
        }
    )
    assert quest_response.status_code == 200
    quest = quest_response.json()
    assert quest["quest_template_id"] is None
    quest_id = quest["id"]

    # Step 2: Update quest (simulate user edits in EditQuestModal)
    update_response = client.put(
        f"/api/quests/{quest_id}",
        json={
            "display_name": "The Kitchen Cleanse",
            "description": "Vanquish the grimy counters",
            "xp_reward": 30,
        }
    )
    assert update_response.status_code == 200

    # Step 3: Convert to template with weekly schedule
    convert_response = client.post(
        f"/api/quests/{quest_id}/convert-to-template",
        json={
            "recurrence": "weekly",
            "schedule": json.dumps({"type": "weekly", "day": "monday", "time": "08:00"}),
            "due_in_hours": 24,
        }
    )
    assert convert_response.status_code == 200
    template = convert_response.json()

    # Verify template has user's edits
    assert template["display_name"] == "The Kitchen Cleanse"
    assert template["xp_reward"] == 30
    assert template["recurrence"] == "weekly"

    # Verify quest is now linked
    quest_check = client.get(f"/api/quests/{quest_id}")
    assert quest_check.json()["quest_template_id"] == template["id"]

    # Verify subscription created
    subs_response = client.get("/api/subscriptions")
    subscriptions = subs_response.json()
    assert any(s["quest_template_id"] == template["id"] for s in subscriptions)


def test_random_quest_stays_standalone(client: TestClient, db_home_with_users):
    """Test random quest remains standalone if not converted"""
    home, user, _user2 = db_home_with_users

    # Create random quest
    quest_response = client.post(f"/api/quests/random?user_id={user.id}")
    assert quest_response.status_code == 200
    quest = quest_response.json()

    # Verify standalone
    assert quest["quest_template_id"] is None

    # Update quest (simulate edit without conversion)
    update_response = client.put(
        f"/api/quests/{quest['id']}",
        json={"xp_reward": 50}
    )
    assert update_response.status_code == 200

    # Verify still standalone
    quest_check = client.get(f"/api/quests/{quest['id']}")
    assert quest_check.json()["quest_template_id"] is None


def test_template_list_not_cluttered(client: TestClient, db_home_with_users):
    """Test that template list only shows converted templates"""
    home, user, _user2 = db_home_with_users

    # Create 3 standalone quests
    for i in range(3):
        client.post(
            f"/api/quests/ai-scribe?user_id={user.id}&skip_ai=true",
            json={"title": f"Quest {i}"}
        )

    # Check template list is empty
    templates_response = client.get("/api/quests/templates/all")
    assert templates_response.status_code == 200
    templates = templates_response.json()
    assert len(templates) == 0

    # Convert one quest to template
    quest_response = client.post(
        f"/api/quests/ai-scribe?user_id={user.id}&skip_ai=true",
        json={"title": "Convert me"}
    )
    quest_id = quest_response.json()["id"]

    client.post(
        f"/api/quests/{quest_id}/convert-to-template",
        json={"recurrence": "daily"}
    )

    # Now template list has 1 entry
    templates_response = client.get("/api/quests/templates/all")
    templates = templates_response.json()
    assert len(templates) == 1
    assert templates[0]["title"] == "Convert me"
