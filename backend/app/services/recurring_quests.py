"""Service for managing recurring quest generation and scheduling logic."""

import calendar
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import Session, or_, select

from app.models.quest import Quest, QuestTemplate
from app.models.user import User


def parse_time(time_str: str) -> tuple[int, int]:
    """
    Parse time string in HH:MM format.

    Args:
        time_str: Time in "HH:MM" format (e.g., "08:00", "18:30")

    Returns:
        Tuple of (hour, minute)

    Raises:
        ValueError: If time format is invalid
    """
    try:
        hour, minute = map(int, time_str.split(":"))
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            raise ValueError(f"Invalid time: {time_str}")
        return hour, minute
    except (ValueError, AttributeError) as e:
        raise ValueError(f"Invalid time format: {time_str}. Expected HH:MM") from e


def calculate_next_generation_time(
    last_generated_at: Optional[datetime], schedule: dict
) -> datetime:
    """
    Calculate when the next quest instance should be generated.

    Args:
        last_generated_at: When we last created an instance (None = never)
        schedule: JSON dict with schedule details

    Returns:
        datetime: The next time a quest should be generated

    Raises:
        ValueError: If schedule type is unknown
    """
    now = datetime.now(timezone.utc)
    schedule_type = schedule.get("type")

    if schedule_type == "daily":
        time_str = schedule.get("time", "00:00")
        hour, minute = parse_time(time_str)

        # Calculate today's scheduled time
        today_scheduled = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

        if last_generated_at is None:
            # Never generated - generate immediately (return today's time)
            # This handles initial template creation and server downtime scenarios
            return today_scheduled

        # Already generated today? Next occurrence is tomorrow
        if last_generated_at.date() == now.date():
            return today_scheduled + timedelta(days=1)

        # Last generated yesterday or earlier - return today's scheduled time
        return today_scheduled

    elif schedule_type == "weekly":
        day_name = schedule.get("day", "monday").lower()
        time_str = schedule.get("time", "00:00")
        hour, minute = parse_time(time_str)

        # Map day names to weekday numbers (0=Monday, 6=Sunday)
        day_map = {
            "monday": 0,
            "tuesday": 1,
            "wednesday": 2,
            "thursday": 3,
            "friday": 4,
            "saturday": 5,
            "sunday": 6,
        }
        target_weekday = day_map.get(day_name, 0)

        # Calculate next occurrence of target weekday
        days_ahead = target_weekday - now.weekday()
        if days_ahead < 0:  # Target day already passed this week
            days_ahead += 7
        elif days_ahead == 0:  # Today is the target day
            if now.hour > hour or (now.hour == hour and now.minute >= minute):
                days_ahead = 7  # Time passed, schedule for next week

        next_occurrence = now + timedelta(days=days_ahead)
        next_occurrence = next_occurrence.replace(
            hour=hour, minute=minute, second=0, microsecond=0
        )

        # Check if we already generated this week
        if last_generated_at and last_generated_at >= (now - timedelta(days=7)):
            # Already generated within last 7 days - skip to next week
            if next_occurrence - last_generated_at < timedelta(days=7):
                next_occurrence += timedelta(days=7)

        return next_occurrence

    elif schedule_type == "monthly":
        day_of_month = schedule.get("day", 1)  # 1-31
        time_str = schedule.get("time", "00:00")
        hour, minute = parse_time(time_str)

        # Check if already generated this month
        if (
            last_generated_at
            and last_generated_at.month == now.month
            and last_generated_at.year == now.year
        ):
            # Already generated this month - calculate next month's date
            if now.month == 12:
                target_date = now.replace(year=now.year + 1, month=1, day=1, hour=hour, minute=minute, second=0, microsecond=0)
            else:
                target_date = now.replace(month=now.month + 1, day=1, hour=hour, minute=minute, second=0, microsecond=0)

            # Handle day overflow for next month
            try:
                target_date = target_date.replace(day=day_of_month)
            except ValueError:
                last_day = calendar.monthrange(target_date.year, target_date.month)[1]
                target_date = target_date.replace(day=last_day)

            return target_date

        # Calculate this month's scheduled date
        target_date = now.replace(day=1, hour=hour, minute=minute, second=0, microsecond=0)

        # Try setting the target day (handle months with fewer days)
        try:
            target_date = target_date.replace(day=day_of_month)
        except ValueError:
            # Day doesn't exist in this month (e.g., Feb 31) - use last day
            last_day = calendar.monthrange(now.year, now.month)[1]
            target_date = target_date.replace(day=last_day)

        # If target already passed this month, move to next month
        if target_date <= now:
            # Move to next month
            if now.month == 12:
                target_date = target_date.replace(year=now.year + 1, month=1)
            else:
                target_date = target_date.replace(month=now.month + 1)

            # Handle day overflow again for next month
            try:
                target_date = target_date.replace(day=day_of_month)
            except ValueError:
                last_day = calendar.monthrange(target_date.year, target_date.month)[1]
                target_date = target_date.replace(day=last_day)

        return target_date

    else:
        raise ValueError(f"Unknown schedule type: {schedule_type}")


def get_home_users(home_id: int, session: Session) -> list[User]:
    """
    Get all users in a home.

    Args:
        home_id: The home ID
        session: Database session

    Returns:
        List of users in the home
    """
    users = session.exec(select(User).where(User.home_id == home_id)).all()
    return list(users)


def generate_due_quests(home_id: int, session: Session) -> None:
    """
    Check all recurring templates and generate overdue instances.

    This function is idempotent - calling it multiple times in the same
    minute won't create duplicates. It skips creation if an incomplete
    instance already exists to prevent quest spam.

    Args:
        home_id: The home ID to generate quests for
        session: Database session
    """
    # Get all recurring templates for this home that might need generation
    templates = session.exec(
        select(QuestTemplate)
        .where(QuestTemplate.home_id == home_id)
        .where(QuestTemplate.recurrence != "one-off")
        .where(
            # Performance optimization: skip recently generated templates
            or_(
                QuestTemplate.last_generated_at.is_(None),
                QuestTemplate.last_generated_at
                < datetime.now(timezone.utc) - timedelta(hours=1),
            )
        )
    ).all()

    now = datetime.now(timezone.utc)

    for template in templates:
        if not template.schedule:
            continue  # Skip templates without schedule config

        try:
            schedule = json.loads(template.schedule)
            next_generation_time = calculate_next_generation_time(
                template.last_generated_at, schedule
            )

            # Check if it's time to generate
            if now >= next_generation_time:
                # Check if incomplete instance already exists (skip if so)
                existing = session.exec(
                    select(Quest)
                    .where(Quest.quest_template_id == template.id)
                    .where(Quest.completed == False)  # noqa: E712
                ).first()

                if existing:
                    continue  # Skip creation to prevent spam

                # Create new quest instance for each user in home
                users = get_home_users(home_id, session)
                for user in users:
                    # Calculate due date if template specifies it
                    due_date = None
                    if template.due_in_hours:
                        due_date = now + timedelta(hours=template.due_in_hours)

                    new_quest = Quest(
                        home_id=home_id,
                        user_id=user.id,
                        quest_template_id=template.id,
                        # Snapshot template data
                        title=template.title,
                        display_name=template.display_name,
                        description=template.description,
                        tags=template.tags,
                        xp_reward=template.xp_reward,
                        gold_reward=template.gold_reward,
                        quest_type="standard",
                        due_date=due_date,
                    )
                    session.add(new_quest)

                # Update last_generated_at to prevent duplicate generation
                template.last_generated_at = now
                session.add(template)

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            # Log error and skip this template if schedule is malformed
            print(f"Error processing template {template.id}: {e}")
            continue

    session.commit()
