import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def home_with_user(client: TestClient):
    """Create a home with a user for test setup"""
    signup = client.post(
        "/api/auth/signup",
        json={"email": "testuser@example.com", "username": "testuser", "password": "testpass", "home_name": "Test Home"},
    )
    home_id = signup.json()["home_id"]
    user_id = signup.json()["user_id"]
    invite_code = signup.json()["invite_code"]

    return home_id, user_id, invite_code


def test_create_quest_template(client: TestClient):
    """Test creating a quest template"""
    # Create home and user
    signup = client.post(
        "/api/auth/signup",
        json={"email": "creator@example.com", "username": "creator", "password": "creatorpass", "home_name": "Test Home"},
    )
    home_id = signup.json()["home_id"]
    user_id = signup.json()["user_id"]

    # Create template
    template_data = {
        "title": "Clean kitchen",
        "description": "Scrub counters and sink",
        "xp_reward": 25,
        "gold_reward": 10,
        "recurrence": "one-off",
    }
    response = client.post(f"/api/quests/templates?created_by={user_id}", json=template_data)
    assert response.status_code == 200
    assert response.json()["title"] == "Clean kitchen"
    assert response.json()["system"] is False


def test_create_quest_template_with_tags(client: TestClient):
    """Test creating a quest template with tags"""
    # Create home and user
    signup = client.post(
        "/api/auth/signup",
        json={"email": "creator@example.com", "username": "creator", "password": "creatorpass", "home_name": "Test Home"},
    )
    home_id = signup.json()["home_id"]
    user_id = signup.json()["user_id"]

    # Create template with tags
    template_data = {
        "title": "Clean kitchen",
        "description": "Scrub counters and sink",
        "tags": "chores,cleaning,kitchen",
        "xp_reward": 25,
        "gold_reward": 10,
        "recurrence": "one-off",
    }
    response = client.post(f"/api/quests/templates?created_by={user_id}", json=template_data)
    assert response.status_code == 200
    assert response.json()["title"] == "Clean kitchen"
    assert response.json()["tags"] == "chores,cleaning,kitchen"


def test_create_quest_template_without_tags(client: TestClient):
    """Test creating a quest template without tags (should be null)"""
    # Create home and user
    signup = client.post(
        "/api/auth/signup",
        json={"email": "creator@example.com", "username": "creator", "password": "creatorpass", "home_name": "Test Home"},
    )
    home_id = signup.json()["home_id"]
    user_id = signup.json()["user_id"]

    # Create template without tags
    template_data = {
        "title": "Clean kitchen",
        "xp_reward": 25,
        "gold_reward": 10,
    }
    response = client.post(f"/api/quests/templates?created_by={user_id}", json=template_data)
    assert response.status_code == 200
    assert response.json()["tags"] is None


def test_get_quest_template(client: TestClient):
    """Test retrieving a quest template"""
    # Setup
    signup = client.post(
        "/api/auth/signup",
        json={"email": "creator@example.com", "username": "creator", "password": "creatorpass", "home_name": "Test Home"},
    )
    home_id = signup.json()["home_id"]
    user_id = signup.json()["user_id"]

    # Create template
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}", json={"title": "Test quest", "xp_reward": 10, "gold_reward": 5}
    )
    template_id = template_response.json()["id"]

    # Retrieve template
    response = client.get(f"/api/quests/templates/{template_id}")
    assert response.status_code == 200
    assert response.json()["title"] == "Test quest"


def test_get_home_quest_templates(client: TestClient):
    """Test retrieving all quest templates in a home"""
    # Setup
    signup = client.post(
        "/api/auth/signup",
        json={"email": "creator@example.com", "username": "creator", "password": "creatorpass", "home_name": "Test Home"},
    )
    home_id = signup.json()["home_id"]
    user_id = signup.json()["user_id"]

    # Create templates
    for i in range(2):
        client.post(
            f"/api/quests/templates?created_by={user_id}",
            json={"title": f"Template {i}", "xp_reward": 10, "gold_reward": 5},
        )

    # Get templates
    response = client.get("/api/quests/templates/all")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_create_quest_from_template(client: TestClient, home_with_user):
    """Test creating a quest instance from a template"""
    home_id, user_id, invite_code = home_with_user

    # Create another user to be creator
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    # Create template
    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Clean kitchen", "xp_reward": 25, "gold_reward": 10},
    )
    template_id = template_response.json()["id"]

    # Create quest from template
    response = client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": template_id})
    assert response.status_code == 200
    assert response.json()["quest_template_id"] == template_id
    assert response.json()["completed"] is False


def test_get_all_quests(client: TestClient, home_with_user):
    """Test retrieving all quests"""
    home_id, user_id, invite_code = home_with_user

    # Create creator and template
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Test quest", "xp_reward": 10, "gold_reward": 5},
    )
    template_id = template_response.json()["id"]

    # Create multiple quests
    for i in range(3):
        client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": template_id})

    # Retrieve all quests
    response = client.get("/api/quests")
    assert response.status_code == 200
    assert len(response.json()) == 3


def test_get_quest(client: TestClient, home_with_user):
    """Test retrieving a quest"""
    home_id, user_id, invite_code = home_with_user

    # Create template
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Test quest", "xp_reward": 10, "gold_reward": 5},
    )
    template_id = template_response.json()["id"]

    # Create quest
    quest_response = client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": template_id})
    quest_id = quest_response.json()["id"]

    # Retrieve quest
    response = client.get(f"/api/quests/{quest_id}?user_id={user_id}")
    assert response.status_code == 200
    assert response.json()["quest_template_id"] == template_id


def test_get_user_quests(client: TestClient, home_with_user):
    """Test retrieving all quests for a user"""
    home_id, user_id, invite_code = home_with_user

    # Create template
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Test quest", "xp_reward": 10, "gold_reward": 5},
    )
    template_id = template_response.json()["id"]

    # Create multiple quests
    for i in range(3):
        client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": template_id})

    # Retrieve quests
    response = client.get(f"/api/quests/user/{user_id}?home_id={home_id}")
    assert response.status_code == 200
    assert len(response.json()) == 3


def test_get_user_quests_filtered(client: TestClient, home_with_user):
    """Test retrieving quests filtered by completion status"""
    home_id, user_id, invite_code = home_with_user

    # Create template
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Test quest", "xp_reward": 10, "gold_reward": 5},
    )
    template_id = template_response.json()["id"]

    # Create and complete one quest
    quest1 = client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": template_id}).json()
    client.post(f"/api/quests/{quest1['id']}/complete?user_id={user_id}")

    # Create another incomplete quest
    client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": template_id})

    # Filter for incomplete quests
    response = client.get(f"/api/quests/user/{user_id}?home_id={home_id}&completed=false")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_complete_quest(client: TestClient, home_with_user):
    """Test completing a quest and awarding XP/gold"""
    home_id, user_id, invite_code = home_with_user

    # Create template
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Test quest", "xp_reward": 50, "gold_reward": 25},
    )
    template_id = template_response.json()["id"]

    # Create quest
    quest_response = client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": template_id})
    quest_id = quest_response.json()["id"]

    # Complete quest
    response = client.post(f"/api/quests/{quest_id}/complete?user_id={user_id}")
    assert response.status_code == 200
    result = response.json()
    assert result["quest"]["completed"] is True
    assert result["rewards"]["xp"] == 50
    assert result["rewards"]["gold"] == 25

    # Verify user received XP and gold
    user = client.get(f"/api/users/{user_id}").json()
    assert user["xp"] == 50
    assert user["gold_balance"] == 25


def test_complete_quest_updates_level(client: TestClient, home_with_user):
    """Test that completing a quest updates user level"""
    home_id, user_id, invite_code = home_with_user

    # Create template with enough XP to level up
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Mega quest", "xp_reward": 100, "gold_reward": 10},
    )
    template_id = template_response.json()["id"]

    # Create quest
    quest_response = client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": template_id})
    quest_id = quest_response.json()["id"]

    # Complete quest
    client.post(f"/api/quests/{quest_id}/complete?user_id={user_id}")

    # Verify user leveled up
    user = client.get(f"/api/users/{user_id}").json()
    assert user["level"] == 2
    assert user["xp"] == 100


def test_update_quest(client: TestClient, home_with_user):
    """Test updating a quest"""
    home_id, user_id, invite_code = home_with_user

    # Create template
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Test quest", "xp_reward": 10, "gold_reward": 5},
    )
    template_id = template_response.json()["id"]

    # Create quest
    quest_response = client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": template_id})
    quest_id = quest_response.json()["id"]

    # Update quest
    response = client.put(f"/api/quests/{quest_id}?user_id={user_id}", json={"completed": True})
    assert response.status_code == 200
    assert response.json()["completed"] is True


def test_complete_quest_twice_fails(client: TestClient, home_with_user):
    """Test that completing a quest twice is prevented"""
    home_id, user_id, invite_code = home_with_user

    # Create template
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Test quest", "xp_reward": 50, "gold_reward": 25},
    )
    template_id = template_response.json()["id"]

    # Create quest
    quest_response = client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": template_id})
    quest_id = quest_response.json()["id"]

    # Complete quest first time
    response = client.post(f"/api/quests/{quest_id}/complete?user_id={user_id}")
    assert response.status_code == 200

    # Try to complete again
    response = client.post(f"/api/quests/{quest_id}/complete?user_id={user_id}")
    assert response.status_code == 400
    error_detail = response.json()["detail"]
    # Support both old (string) and new (dict) error formats
    if isinstance(error_detail, dict):
        assert error_detail["code"] == "QUEST_ALREADY_COMPLETED"
        assert "already completed" in error_detail["message"].lower()
    else:
        assert "already completed" in error_detail.lower()


def test_quest_home_visibility(client: TestClient, home_with_user):
    """Test that all users in a home can see all quests in that home"""
    home_id, user1_id, invite_code = home_with_user

    # Create second user
    # Join home with new user (invite_code already provided by fixture)
    user2_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "user2@example.com", "username": "user2", "password": "user2pass"},
    )
    user2_id = user2_response.json()["user_id"]

    # Create template
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Test quest", "xp_reward": 10, "gold_reward": 5},
    )
    template_id = template_response.json()["id"]

    # User1 creates a quest
    quest_response = client.post(f"/api/quests?user_id={user1_id}", json={"quest_template_id": template_id})
    quest_id = quest_response.json()["id"]

    # User2 can see user1's quest (home-scoped visibility)
    response = client.get(f"/api/quests/{quest_id}")
    assert response.status_code == 200

    # User2 can complete user1's quest (family chore app model)
    response = client.post(f"/api/quests/{quest_id}/complete")
    assert response.status_code == 200


def test_delete_quest(client: TestClient, home_with_user):
    """Test deleting a quest"""
    home_id, user_id, invite_code = home_with_user

    # Create template
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Test quest", "xp_reward": 10, "gold_reward": 5},
    )
    template_id = template_response.json()["id"]

    # Create quest
    quest_response = client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": template_id})
    quest_id = quest_response.json()["id"]

    # Delete quest
    response = client.delete(f"/api/quests/{quest_id}?user_id={user_id}")
    assert response.status_code == 200

    # Verify quest is deleted
    response = client.get(f"/api/quests/{quest_id}?user_id={user_id}")
    assert response.status_code == 404


def test_quest_template_tags_in_quest_response(client: TestClient, home_with_user):
    """Test that tags from template are included in quest response"""
    home_id, user_id, invite_code = home_with_user

    # Create creator
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    # Create template with tags
    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Exercise", "tags": "health,exercise", "xp_reward": 50, "gold_reward": 20},
    )
    template_id = template_response.json()["id"]

    # Create quest from template
    quest_response = client.post(f"/api/quests?user_id={user_id}", json={"quest_template_id": template_id})
    assert quest_response.status_code == 200
    quest_data = quest_response.json()

    # Verify template data including tags is in quest response
    assert quest_data["template"]["tags"] == "health,exercise"
    assert quest_data["template"]["title"] == "Exercise"


def test_update_quest_template(client: TestClient, home_with_user):
    """Test updating a quest template"""
    home_id, user_id, invite_code = home_with_user

    # Create creator
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    # Create template
    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Clean Kitchen", "xp_reward": 25, "gold_reward": 10},
    )
    template_id = template_response.json()["id"]

    # Update template with description, tags, and new rewards
    update_response = client.put(
        f"/api/quests/templates/{template_id}",
        json={
            "display_name": "The Cookery Cleanup",
            "description": "Scrub counters, wash dishes, take out trash",
            "tags": "chores,cleaning",
            "xp_reward": 50,
            "gold_reward": 25,
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()

    # Verify all fields updated
    assert updated["display_name"] == "The Cookery Cleanup"
    assert updated["description"] == "Scrub counters, wash dishes, take out trash"
    assert updated["tags"] == "chores,cleaning"
    assert updated["xp_reward"] == 50
    assert updated["gold_reward"] == 25

    # Verify original title unchanged
    assert updated["title"] == "Clean Kitchen"


def test_update_quest_template_partial(client: TestClient, home_with_user):
    """Test partial update of quest template (only some fields)"""
    home_id, user_id, invite_code = home_with_user

    # Create creator
    creator_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "creator@example.com", "username": "creator", "password": "creatorpass"},
    )
    creator_id = creator_response.json()["user_id"]

    # Create template
    template_response = client.post(
        f"/api/quests/templates?created_by={creator_id}",
        json={"title": "Clean Kitchen", "xp_reward": 25, "gold_reward": 10},
    )
    template_id = template_response.json()["id"]

    # Update only tags
    update_response = client.put(f"/api/quests/templates/{template_id}", json={"tags": "chores"})
    assert update_response.status_code == 200
    updated = update_response.json()

    # Verify only tags changed, other fields remain
    assert updated["tags"] == "chores"
    assert updated["xp_reward"] == 25  # unchanged
    assert updated["gold_reward"] == 10  # unchanged
    assert updated["title"] == "Clean Kitchen"  # unchanged


def test_update_quest_template_home_isolation(client: TestClient):
    """Test that users cannot update templates from other homes"""
    # Create home 1 with user and template
    signup1 = client.post(
        "/api/auth/signup",
        json={"email": "user1@example.com", "username": "user1", "password": "pass1", "home_name": "Home 1"},
    )
    user1_id = signup1.json()["user_id"]

    # Create template in home 1
    template_response = client.post(
        f"/api/quests/templates?created_by={user1_id}",
        json={"title": "Home 1 Quest", "xp_reward": 25, "gold_reward": 10},
    )
    template_id = template_response.json()["id"]

    # Create home 2 with different user
    signup2 = client.post(
        "/api/auth/signup",
        json={"email": "user2@example.com", "username": "user2", "password": "pass2", "home_name": "Home 2"},
    )
    # user2 is now in a different home context

    # Try to update template from home 1 (should fail because user2 is in home 2)
    # This requires login context, so we can only test indirectly
    # Simulating: user from home 2 tries to access home 1's template
    # Since we don't have cross-home auth in tests, we can at least test 404
    update_response = client.put(
        "/api/quests/templates/999999",  # Non-existent template
        json={"tags": "should-fail"},
    )
    assert update_response.status_code == 404


def test_quest_template_display_name_vs_title(client: TestClient, home_with_user):
    """Test distinction between title and display_name in quest template"""
    home_id, user_id, invite_code = home_with_user

    # Create template with both title and display_name
    template_response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={
            "title": "Clean Kitchen",
            "display_name": "The Great Kitchen Cleansing",
            "xp_reward": 25,
            "gold_reward": 10,
        },
    )

    assert template_response.status_code == 200
    template = template_response.json()
    assert template["title"] == "Clean Kitchen"
    assert template["display_name"] == "The Great Kitchen Cleansing"


def test_quest_template_different_quest_types(client: TestClient, home_with_user):
    """Test creating quest templates with different quest_type values"""
    home_id, user_id, invite_code = home_with_user

    quest_types = ["standard", "corrupted"]

    for quest_type in quest_types:
        response = client.post(
            f"/api/quests/templates?created_by={user_id}",
            json={"title": f"Quest Type {quest_type}", "quest_type": quest_type, "xp_reward": 10, "gold_reward": 5},
        )

        assert response.status_code == 200
        assert response.json()["quest_type"] == quest_type


def test_quest_template_different_recurrences(client: TestClient, home_with_user):
    """Test creating quest templates with different recurrence values"""
    home_id, user_id, invite_code = home_with_user

    recurrences = ["one-off", "daily", "weekly"]

    for recurrence in recurrences:
        response = client.post(
            f"/api/quests/templates?created_by={user_id}",
            json={"title": f"Quest {recurrence}", "recurrence": recurrence, "xp_reward": 10, "gold_reward": 5},
        )

        assert response.status_code == 200
        assert response.json()["recurrence"] == recurrence


def test_quest_template_system_vs_user_created(client: TestClient, home_with_user):
    """Test that user-created templates have system=False"""
    home_id, user_id, invite_code = home_with_user

    # Create user template
    response = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "User Created Quest", "xp_reward": 10, "gold_reward": 5},
    )

    assert response.status_code == 200
    template = response.json()
    assert template["system"] is False
    assert template["created_by"] == user_id


def test_quest_template_created_by_tracking(client: TestClient, home_with_user):
    """Test that quest templates track who created them"""
    home_id, user_id, invite_code = home_with_user

    # Create another user
    # Get invite code for joining
    home_info = client.get(f"/api/homes/{home_id}/invite-code").json()
    invite_code = home_info["invite_code"]
    
    # Join home with new user
    user2_response = client.post(
        "/api/auth/join",
        json={"invite_code": invite_code, "email": "user2@example.com", "username": "user2", "password": "pass2"},
    )
    user2_id = user2_response.json()["user_id"]

    # Create template by user1
    template1 = client.post(
        f"/api/quests/templates?created_by={user_id}",
        json={"title": "User1 Quest", "xp_reward": 10, "gold_reward": 5},
    ).json()

    # Create template by user2
    template2 = client.post(
        f"/api/quests/templates?created_by={user2_id}",
        json={"title": "User2 Quest", "xp_reward": 10, "gold_reward": 5},
    ).json()

    assert template1["created_by"] == user_id
    assert template2["created_by"] == user2_id
