import json
from fastapi.testclient import TestClient
from sqlmodel import Session

def test_convert_standalone_quest_to_template(client: TestClient, db_home_with_users):
    """Test converting a standalone quest to a template"""
    home, user, _user2 = db_home_with_users

    # Create standalone quest
    quest_response = client.post(
        f"/api/quests/standalone?user_id={user.id}",
        json={
            "title": "Clean kitchen",
            "display_name": "The Kitchen Cleanse",
            "description": "Vanquish the grime",
            "tags": "chores,cleaning",
            "xp_reward": 30,
            "gold_reward": 15
        }
    )
    assert quest_response.status_code == 200
    quest = quest_response.json()
    assert quest["quest_template_id"] is None

    # Convert to template with weekly schedule
    convert_response = client.post(
        f"/api/quests/{quest['id']}/convert-to-template",
        json={
            "recurrence": "weekly",
            "schedule": json.dumps({"type": "weekly", "day": "monday", "time": "08:00"}),
            "due_in_hours": 24
        }
    )
    assert convert_response.status_code == 200
    template = convert_response.json()

    # Verify template created
    assert template["title"] == "Clean kitchen"
    assert template["display_name"] == "The Kitchen Cleanse"
    assert template["recurrence"] == "weekly"

    # Verify quest now linked to template
    quest_check = client.get(f"/api/quests/{quest['id']}")
    assert quest_check.status_code == 200
    updated_quest = quest_check.json()
    assert updated_quest["quest_template_id"] == template["id"]

    # Verify subscription created for user
    subs_response = client.get("/api/subscriptions")
    assert subs_response.status_code == 200
    subscriptions = subs_response.json()
    user_sub = next((s for s in subscriptions if s["quest_template_id"] == template["id"]), None)
    assert user_sub is not None
    assert user_sub["recurrence"] == "weekly"


def test_convert_already_templated_quest_fails(client: TestClient, db_home_with_users):
    """Test that converting an already-templated quest fails"""
    home, user, _user2 = db_home_with_users

    # Create template
    template_response = client.post(
        f"/api/quests/templates?created_by={user.id}",
        json={"title": "Clean kitchen"}
    )
    assert template_response.status_code == 200
    template = template_response.json()

    # Create quest from template
    quest_response = client.post(
        f"/api/quests?user_id={user.id}",
        json={"quest_template_id": template["id"]}
    )
    assert quest_response.status_code == 200
    quest = quest_response.json()

    # Try to convert (should fail)
    convert_response = client.post(
        f"/api/quests/{quest['id']}/convert-to-template",
        json={"recurrence": "daily"}
    )
    assert convert_response.status_code == 400
    assert "already linked" in convert_response.json()["detail"].lower()
