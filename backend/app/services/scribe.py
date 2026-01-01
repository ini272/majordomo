"""AI Scribe Service - Generates quest content using Groq API"""
import json
import logging
import os
from typing import Optional, Dict
from groq import Groq

logger = logging.getLogger(__name__)

GROQ_MODEL = "llama-3.3-70b-versatile"  # Latest fast model, free tier available

# Available tags for validation
AVAILABLE_TAGS = [
    "chores",
    "cleaning",
    "exercise",
    "health",
    "learning",
    "organization",
]


class ScribeResponse:
    """Parsed response from Groq"""

    def __init__(self, data: Dict):
        self.display_name = data.get("display_name", "").strip()
        self.description = data.get("description", "").strip()
        self.tags = data.get("tags", "").strip()
        self.time = int(data.get("time", 2))
        self.effort = int(data.get("effort", 2))
        self.dread = int(data.get("dread", 2))

        # Validate ranges
        self.time = max(1, min(5, self.time))
        self.effort = max(1, min(5, self.effort))
        self.dread = max(1, min(5, self.dread))

    def calculate_xp(self, multiplier: int = 2) -> int:
        """Calculate XP based on time/effort/dread formula"""
        base = (self.time + self.effort + self.dread) * multiplier
        return max(1, base)

    def calculate_gold(self) -> int:
        """Calculate gold as half of XP"""
        return max(1, self.calculate_xp() // 2)


def generate_quest_content(quest_title: str) -> Optional[ScribeResponse]:
    """
    Call Groq API to generate quest content from title.

    Returns ScribeResponse on success, None on failure.
    """
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        logger.warning("GROQ_API_KEY not set, skipping Scribe generation")
        return None

    try:
        client = Groq(api_key=groq_api_key)

        prompt = f"""You are a fantasy game quest designer. Generate engaging quest content for this quest title:

"{quest_title}"

Return ONLY a valid JSON object (no markdown, no code blocks) with these exact fields:
- display_name: A fantasy variant of the title (1-2 words, creative and thematic)
- description: A witty, engaging description (1-2 sentences, in fantasy RPG style)
- tags: Comma-separated tags from this list: chores, cleaning, exercise, health, learning, organization
- time: Estimated time on scale 1-5 (1=quick, 5=long)
- effort: Physical/mental effort on scale 1-5 (1=easy, 5=hard)
- dread: How much you dread doing it on scale 1-5 (1=love it, 5=hate it)

Example output:
{{"display_name": "The Cookery Cleanup", "description": "Vanquish the grimy counters and slay the sink dragon.", "tags": "chores,cleaning", "time": 3, "effort": 2, "dread": 4}}

Now generate for: {quest_title}"""

        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=500,
        )

        response_text = response.choices[0].message.content.strip()

        # Parse JSON response
        try:
            data = json.loads(response_text)
            scribe_response = ScribeResponse(data)
            logger.info(f"Scribe generated content for: {quest_title}")
            return scribe_response
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Groq JSON response: {response_text[:200]}")
            return None

    except Exception as e:
        logger.error(f"Groq API error: {str(e)}")
        return None
