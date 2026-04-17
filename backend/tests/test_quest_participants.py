from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.home import Home
from app.models.user import User


def _participant_user_ids(quest: dict) -> list[int]:
    return sorted(participant["user_id"] for participant in quest["participants"])


def test_create_shared_standalone_quest(client: TestClient, db_home_with_users, auth_context):
    home, user1, user2 = db_home_with_users
    auth_context.set_user(user1.id, home.id)

    response = client.post(
        "/api/quests/standalone",
        json={
            "title": "Clean together",
            "xp_reward": 21,
            "gold_reward": 11,
            "participant_user_ids": [user1.id, user2.id],
        },
    )

    assert response.status_code == 200
    quest = response.json()
    assert quest["user_id"] == user1.id
    assert _participant_user_ids(quest) == [user1.id, user2.id]


def test_user_quest_list_includes_shared_participation(client: TestClient, db_home_with_users, auth_context):
    home, user1, user2 = db_home_with_users
    auth_context.set_user(user1.id, home.id)

    create_response = client.post(
        "/api/quests/standalone",
        json={
            "title": "Shared list quest",
            "xp_reward": 10,
            "gold_reward": 5,
            "participant_user_ids": [user1.id, user2.id],
        },
    )
    quest_id = create_response.json()["id"]

    response = client.get(f"/api/quests/user/{user2.id}")

    assert response.status_code == 200
    assert [quest["id"] for quest in response.json()] == [quest_id]


def test_create_shared_quest_dedupes_participant_ids(client: TestClient, db_home_with_users, auth_context):
    home, user1, user2 = db_home_with_users
    auth_context.set_user(user1.id, home.id)

    response = client.post(
        "/api/quests/standalone",
        json={
            "title": "Duplicate participant quest",
            "participant_user_ids": [user1.id, user2.id, user1.id],
        },
    )

    assert response.status_code == 200
    quest = response.json()
    assert quest["user_id"] == user1.id
    assert _participant_user_ids(quest) == [user1.id, user2.id]


def test_complete_shared_quest_splits_rewards(client: TestClient, db_home_with_users, auth_context):
    home, user1, user2 = db_home_with_users
    auth_context.set_user(user1.id, home.id)

    create_response = client.post(
        "/api/quests/standalone",
        json={
            "title": "Shared reward quest",
            "xp_reward": 21,
            "gold_reward": 11,
            "participant_user_ids": [user1.id, user2.id],
        },
    )
    quest_id = create_response.json()["id"]

    complete_response = client.post(f"/api/quests/{quest_id}/complete")

    assert complete_response.status_code == 200
    result = complete_response.json()
    assert result["quest"]["completed"] is True
    assert result["rewards"]["xp"] == 21
    assert result["rewards"]["gold"] == 11

    participant_rewards = {
        reward["user_id"]: reward for reward in result["rewards"]["participants"]
    }
    assert participant_rewards[user1.id]["xp"] == 11
    assert participant_rewards[user1.id]["gold"] == 6
    assert participant_rewards[user2.id]["xp"] == 10
    assert participant_rewards[user2.id]["gold"] == 5

    user1_stats = client.get(f"/api/users/{user1.id}").json()
    user2_stats = client.get(f"/api/users/{user2.id}").json()
    assert user1_stats["xp"] == 11
    assert user1_stats["gold_balance"] == 6
    assert user2_stats["xp"] == 10
    assert user2_stats["gold_balance"] == 5


def test_shared_quest_rejects_participant_outside_home(
    client: TestClient,
    db: Session,
    db_home_with_users,
    auth_context,
):
    home, user1, _user2 = db_home_with_users
    auth_context.set_user(user1.id, home.id)

    other_home = Home(name="Other Home", invite_code="OTHER123")
    db.add(other_home)
    db.commit()
    db.refresh(other_home)
    outsider = User(
        username="outsider",
        email="outsider@test.com",
        password_hash="$2b$12$test_hash_3",
        home_id=other_home.id,
    )
    db.add(outsider)
    db.commit()
    db.refresh(outsider)

    response = client.post(
        "/api/quests/standalone",
        json={
            "title": "Invalid shared quest",
            "participant_user_ids": [user1.id, outsider.id],
        },
    )

    assert response.status_code == 404


def test_completed_shared_quest_party_cannot_change(client: TestClient, db_home_with_users, auth_context):
    home, user1, user2 = db_home_with_users
    auth_context.set_user(user1.id, home.id)

    create_response = client.post(
        "/api/quests/standalone",
        json={
            "title": "Locked party quest",
            "participant_user_ids": [user1.id, user2.id],
        },
    )
    quest_id = create_response.json()["id"]
    complete_response = client.post(f"/api/quests/{quest_id}/complete")
    assert complete_response.status_code == 200

    response = client.put(
        f"/api/quests/{quest_id}",
        json={"participant_user_ids": [user1.id]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Completed quests cannot be reassigned"
