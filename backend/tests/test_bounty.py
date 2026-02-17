from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.daily_bounty import DailyBounty
from app.models.quest import Quest


def _create_standalone_quest(client: TestClient, user_id: int, title: str = "Quest", xp: int = 10, gold: int = 5) -> dict:
    response = client.post(
        f"/api/quests/standalone?user_id={user_id}",
        json={"title": title, "xp_reward": xp, "gold_reward": gold},
    )
    assert response.status_code == 200
    return response.json()


def _age_quest(db: Session, quest_id: int, hours_ago: int) -> None:
    quest = db.get(Quest, quest_id)
    assert quest is not None
    quest.created_at = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    db.add(quest)
    db.commit()


def test_get_today_bounty_returns_none_eligible_and_locks_day(client: TestClient, home_with_user, db: Session):
    """First request should lock today as none_eligible if user has no 48h+ active quests."""
    _, user_id, _ = home_with_user

    response1 = client.get("/api/bounty/today")
    assert response1.status_code == 200

    data1 = response1.json()
    assert data1["status"] == "none_eligible"
    assert data1["quest"] is None
    assert data1["bonus_multiplier"] == 1

    # Add an eligible quest after today's decision has been locked.
    quest = _create_standalone_quest(client, user_id, title="Late Quest")
    _age_quest(db, quest["id"], hours_ago=49)

    response2 = client.get("/api/bounty/today")
    assert response2.status_code == 200

    data2 = response2.json()
    assert data2["status"] == "none_eligible"
    assert data2["quest"] is None
    assert data2["bounty_date"] == data1["bounty_date"]


def test_get_today_bounty_assigns_eligible_standalone_quest(client: TestClient, home_with_user, db: Session):
    """Standalone active quest older than 48h should be eligible for daily bounty."""
    _, user_id, _ = home_with_user
    quest = _create_standalone_quest(client, user_id, title="Old Chore")
    _age_quest(db, quest["id"], hours_ago=49)

    response = client.get("/api/bounty/today")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "assigned"
    assert data["bonus_multiplier"] == 2
    assert data["quest"] is not None
    assert data["quest"]["id"] == quest["id"]


def test_get_today_bounty_enforces_strict_48h_gate(client: TestClient, home_with_user, db: Session):
    """Quest younger than 48 hours should not be eligible."""
    _, user_id, _ = home_with_user
    quest = _create_standalone_quest(client, user_id, title="Too New")
    _age_quest(db, quest["id"], hours_ago=47)

    response = client.get("/api/bounty/today")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "none_eligible"
    assert data["quest"] is None
    assert data["bonus_multiplier"] == 1


def test_complete_quest_without_prior_bounty_fetch_still_applies_bounty(
    client: TestClient, home_with_user, db: Session
):
    """Completing an eligible quest should apply bounty even if /bounty/today was never called."""
    _, user_id, _ = home_with_user
    quest = _create_standalone_quest(client, user_id, title="Complete Me", xp=12, gold=7)
    _age_quest(db, quest["id"], hours_ago=50)

    complete = client.post(f"/api/quests/{quest['id']}/complete")
    assert complete.status_code == 200
    result = complete.json()

    assert result["rewards"]["is_daily_bounty"] is True
    assert result["rewards"]["bounty_multiplier"] == 2
    assert result["rewards"]["xp"] == 24
    assert result["rewards"]["gold"] == 14


def test_complete_non_bounty_quest_has_normal_rewards(client: TestClient, home_with_user, db: Session):
    """Only the selected quest instance should receive 2x rewards."""
    _, user_id, _ = home_with_user
    quest1 = _create_standalone_quest(client, user_id, title="A", xp=10, gold=5)
    quest2 = _create_standalone_quest(client, user_id, title="B", xp=20, gold=9)
    _age_quest(db, quest1["id"], hours_ago=60)
    _age_quest(db, quest2["id"], hours_ago=61)

    bounty = client.get("/api/bounty/today")
    assert bounty.status_code == 200
    assigned_id = bounty.json()["quest"]["id"]
    other = quest1 if assigned_id == quest2["id"] else quest2

    complete = client.post(f"/api/quests/{other['id']}/complete")
    assert complete.status_code == 200
    result = complete.json()

    assert result["rewards"]["is_daily_bounty"] is False
    assert result["rewards"]["bounty_multiplier"] == 1
    assert result["rewards"]["xp"] == other["xp_reward"]
    assert result["rewards"]["gold"] == other["gold_reward"]


def test_no_consecutive_repeat_unless_only_one_candidate(client: TestClient, home_with_user, db: Session):
    """Yesterday's assigned quest should be excluded when more than one candidate exists."""
    home_id, user_id, _ = home_with_user
    quest1 = _create_standalone_quest(client, user_id, title="Yesterday")
    quest2 = _create_standalone_quest(client, user_id, title="Today")
    _age_quest(db, quest1["id"], hours_ago=55)
    _age_quest(db, quest2["id"], hours_ago=56)

    yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
    db.add(
        DailyBounty(
            home_id=home_id,
            user_id=user_id,
            quest_id=quest1["id"],
            bounty_date=yesterday,
            status="assigned",
        )
    )
    db.commit()

    response = client.get("/api/bounty/today")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "assigned"
    assert data["quest"]["id"] == quest2["id"]


def test_repeat_allowed_when_only_one_candidate(client: TestClient, home_with_user, db: Session):
    """If only one candidate exists, repeating yesterday's quest is allowed."""
    home_id, user_id, _ = home_with_user
    quest = _create_standalone_quest(client, user_id, title="Only Candidate")
    _age_quest(db, quest["id"], hours_ago=55)

    yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
    db.add(
        DailyBounty(
            home_id=home_id,
            user_id=user_id,
            quest_id=quest["id"],
            bounty_date=yesterday,
            status="assigned",
        )
    )
    db.commit()

    response = client.get("/api/bounty/today")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "assigned"
    assert data["quest"]["id"] == quest["id"]
