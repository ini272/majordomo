"""Tests for AI Scribe service"""

import pytest

from app.services.scribe import ScribeResponse, generate_quest_content


def test_scribe_response_xp_calculation():
    """Test XP calculation formula"""
    data = {
        "display_name": "Test Quest",
        "description": "A test",
        "tags": "chores",
        "time": 3,
        "effort": 2,
        "dread": 4,
    }
    response = ScribeResponse(data)

    # (3 + 2 + 4) * 2 = 18
    assert response.calculate_xp() == 18
    assert response.calculate_gold() == 9  # 18 // 2


def test_scribe_response_xp_bounds():
    """Test XP calculation respects minimum values"""
    data = {
        "display_name": "Test",
        "description": "Test",
        "tags": "",
        "time": 1,
        "effort": 1,
        "dread": 1,
    }
    response = ScribeResponse(data)

    # (1 + 1 + 1) * 2 = 6
    assert response.calculate_xp() == 6
    assert response.calculate_gold() == 3


def test_scribe_response_clamps_out_of_range():
    """Test that time/effort/dread are clamped to 1-5 range"""
    data = {
        "display_name": "Test",
        "description": "Test",
        "tags": "",
        "time": 10,  # Should clamp to 5
        "effort": -1,  # Should clamp to 1
        "dread": 3,
    }
    response = ScribeResponse(data)

    assert response.time == 5
    assert response.effort == 1
    assert response.dread == 3


@pytest.mark.integration
def test_generate_quest_content_with_groq():
    """Integration test: Call actual Groq API"""
    # This requires GROQ_API_KEY to be set
    response = generate_quest_content("Clean Kitchen")

    if response is None:
        pytest.skip("GROQ_API_KEY not set or API unavailable")

    # Verify response has content
    assert response.display_name, "display_name should not be empty"
    assert response.description, "description should not be empty"
    assert 1 <= response.time <= 5, "time should be 1-5"
    assert 1 <= response.effort <= 5, "effort should be 1-5"
    assert 1 <= response.dread <= 5, "dread should be 1-5"

    # Verify XP calculation
    xp = response.calculate_xp()
    assert xp >= 6, f"XP should be at least 6, got {xp}"
    assert xp <= 50, f"XP should be at most 50, got {xp}"

    # Verify gold
    gold = response.calculate_gold()
    assert gold >= 3, f"Gold should be at least 3, got {gold}"


@pytest.mark.integration
def test_generate_quest_content_various_titles():
    """Integration test: Try different quest titles"""
    titles = ["Exercise", "Learn Programming", "Do Laundry", "Organize Garage"]

    for title in titles:
        response = generate_quest_content(title)

        if response is None:
            pytest.skip("GROQ_API_KEY not set or API unavailable")

        assert response.display_name, f"display_name empty for title: {title}"
        assert response.description, f"description empty for title: {title}"
        assert 1 <= response.time <= 5, f"time out of range for title: {title}"
