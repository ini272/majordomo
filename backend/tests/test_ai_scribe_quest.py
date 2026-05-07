from fastapi.testclient import TestClient
from sqlmodel import Session

from app.crud import quest as crud_quest
from app.models.quest import QuestCreateStandalone
from app.routes import quest as quest_routes
from app.services.scribe import ScribeResponse


def test_create_ai_scribe_quest_schedules_generation_without_live_groq(
    client: TestClient,
    home_with_user,
    monkeypatch,
):
    """The real AI Scribe create path should be covered without a Groq key."""
    _home_id, user_id, _invite_code = home_with_user
    scheduled_tasks: list[tuple[int, str]] = []

    def fake_generate_and_update_quest(quest_id: int, quest_title: str):
        scheduled_tasks.append((quest_id, quest_title))

    monkeypatch.setattr(quest_routes, "_generate_and_update_quest", fake_generate_and_update_quest)

    response = client.post(
        "/api/quests/ai-scribe",
        json={"title": "Clean Kitchen", "participant_user_ids": [user_id]},
    )

    assert response.status_code == 200, response.text
    quest = response.json()
    assert scheduled_tasks == [(quest["id"], "Clean Kitchen")]
    assert quest["title"] == "Clean Kitchen"
    assert quest["user_id"] == user_id
    assert [participant["user_id"] for participant in quest["participants"]] == [user_id]


def test_apply_scribe_response_to_quest_updates_empty_fields(db: Session, db_home_with_users):
    home, user, _other_user = db_home_with_users
    quest = crud_quest.create_standalone_quest(
        db,
        home.id,
        user.id,
        [user.id],
        QuestCreateStandalone(title="Clean Kitchen", xp_reward=1, gold_reward=1),
    )
    scribe_response = ScribeResponse(
        {
            "display_name": "The Kitchen Cleanse",
            "description": "Vanquish grime from the counters.",
            "tags": "chores,cleaning",
            "time": 3,
            "effort": 2,
            "dread": 4,
        }
    )

    assert quest_routes._apply_scribe_response_to_quest(db, quest.id, scribe_response) is True

    db.refresh(quest)
    assert quest.display_name == "The Kitchen Cleanse"
    assert quest.description == "Vanquish grime from the counters."
    assert quest.tags == "chores,cleaning"
    assert quest.xp_reward == 18
    assert quest.gold_reward == 9


def test_apply_scribe_response_to_quest_preserves_manual_copy(db: Session, db_home_with_users):
    home, user, _other_user = db_home_with_users
    quest = crud_quest.create_standalone_quest(
        db,
        home.id,
        user.id,
        [user.id],
        QuestCreateStandalone(
            title="Clean Kitchen",
            display_name="Manual Name",
            description="Manual description",
            tags="chores",
            xp_reward=4,
            gold_reward=2,
        ),
    )
    scribe_response = ScribeResponse(
        {
            "display_name": "The Kitchen Cleanse",
            "description": "Vanquish grime from the counters.",
            "tags": "chores,cleaning",
            "time": 5,
            "effort": 5,
            "dread": 5,
        }
    )

    assert quest_routes._apply_scribe_response_to_quest(db, quest.id, scribe_response) is True

    db.refresh(quest)
    assert quest.display_name == "Manual Name"
    assert quest.description == "Manual description"
    assert quest.tags == "chores"
    assert quest.xp_reward == 30
    assert quest.gold_reward == 15


def test_regenerate_scribe_preview_returns_copy_without_updating_quest(
    client: TestClient,
    db: Session,
    db_home_with_users,
    monkeypatch,
):
    home, user, _other_user = db_home_with_users
    quest = crud_quest.create_standalone_quest(
        db,
        home.id,
        user.id,
        [user.id],
        QuestCreateStandalone(
            title="Clean Kitchen",
            display_name="Old Name",
            description="Old description",
            tags="chores",
            xp_reward=12,
            gold_reward=6,
        ),
    )

    def fake_generate_quest_content(quest_title: str):
        assert quest_title == "Clean Kitchen"
        return ScribeResponse(
            {
                "display_name": "Sink Dragon",
                "description": "The sink dragon has grown bold.",
                "tags": "chores,cleaning",
                "time": 4,
                "effort": 4,
                "dread": 4,
            }
        )

    monkeypatch.setattr(quest_routes, "generate_quest_content", fake_generate_quest_content)

    response = client.post(f"/api/quests/{quest.id}/scribe-preview")

    assert response.status_code == 200, response.text
    assert response.json() == {
        "display_name": "Sink Dragon",
        "description": "The sink dragon has grown bold.",
        "tags": "chores,cleaning",
    }

    db.refresh(quest)
    assert quest.display_name == "Old Name"
    assert quest.description == "Old description"
    assert quest.tags == "chores"
    assert quest.xp_reward == 12
    assert quest.gold_reward == 6


def test_regenerate_scribe_preview_rejects_completed_quest(
    client: TestClient,
    db: Session,
    db_home_with_users,
    monkeypatch,
):
    home, user, _other_user = db_home_with_users
    quest = crud_quest.create_standalone_quest(
        db,
        home.id,
        user.id,
        [user.id],
        QuestCreateStandalone(title="Clean Kitchen"),
    )
    quest.completed = True
    db.add(quest)
    db.commit()
    db.refresh(quest)

    def fail_generate_quest_content(_quest_title: str):
        raise AssertionError("completed quests should not call Scribe")

    monkeypatch.setattr(quest_routes, "generate_quest_content", fail_generate_quest_content)

    response = client.post(f"/api/quests/{quest.id}/scribe-preview")

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "QUEST_ALREADY_COMPLETED"
