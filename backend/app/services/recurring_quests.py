"""Service for managing recurring quest generation and scheduling logic."""

import calendar
import json
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlmodel import Session, or_, select

from app.crud import quest as crud_quest
from app.models.home import Home
from app.models.quest import Quest, QuestParticipant, QuestTemplate, UserTemplateSubscription
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


def _get_schedule_timezone(home_timezone: str) -> ZoneInfo:
    try:
        return ZoneInfo(home_timezone or "UTC")
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def _as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def calculate_next_generation_time(
    last_generated_at: Optional[datetime], schedule: dict, home_timezone: str = "UTC"
) -> datetime:
    """
    Calculate when the next quest instance should be generated.

    Args:
        last_generated_at: When we last created an instance (None = never)
        schedule: JSON dict with schedule details
        home_timezone: IANA timezone that schedule wall-clock times are interpreted in

    Returns:
        datetime: The next time a quest should be generated, as a UTC instant

    Raises:
        ValueError: If schedule type is unknown
    """
    schedule_timezone = _get_schedule_timezone(home_timezone)
    now = datetime.now(timezone.utc)
    now_local = now.astimezone(schedule_timezone)
    last_generated_local = (
        _as_aware_utc(last_generated_at).astimezone(schedule_timezone)
        if last_generated_at
        else None
    )
    schedule_type = schedule.get("type")

    if schedule_type == "daily":
        time_str = schedule.get("time", "00:00")
        hour, minute = parse_time(time_str)

        # Calculate today's scheduled time
        today_scheduled = now_local.replace(hour=hour, minute=minute, second=0, microsecond=0)

        if last_generated_local is None:
            # Never generated - generate immediately (return today's time)
            # This handles initial template creation and server downtime scenarios
            return today_scheduled.astimezone(timezone.utc)

        # Already generated today? Next occurrence is tomorrow
        if last_generated_local.date() == now_local.date():
            return (today_scheduled + timedelta(days=1)).astimezone(timezone.utc)

        # Last generated yesterday or earlier - return today's scheduled time
        return today_scheduled.astimezone(timezone.utc)

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

        if last_generated_local is None:
            days_behind = now_local.weekday() - target_weekday
            if days_behind < 0:
                days_behind += 7

            most_recent_occurrence = now_local - timedelta(days=days_behind)
            most_recent_occurrence = most_recent_occurrence.replace(
                hour=hour, minute=minute, second=0, microsecond=0
            )

            if most_recent_occurrence <= now_local:
                return most_recent_occurrence.astimezone(timezone.utc)

        # Calculate next occurrence of target weekday
        days_ahead = target_weekday - now_local.weekday()
        if days_ahead < 0:  # Target day already passed this week
            days_ahead += 7
        elif days_ahead == 0:  # Today is the target day
            if now_local.hour > hour or (now_local.hour == hour and now_local.minute >= minute):
                days_ahead = 7  # Time passed, schedule for next week

        next_occurrence = now_local + timedelta(days=days_ahead)
        next_occurrence = next_occurrence.replace(
            hour=hour, minute=minute, second=0, microsecond=0
        )

        # Check if we already generated this week
        if last_generated_local and last_generated_local >= (now_local - timedelta(days=7)):
            # Already generated within last 7 days - skip to next week
            if next_occurrence - last_generated_local < timedelta(days=7):
                next_occurrence += timedelta(days=7)

        return next_occurrence.astimezone(timezone.utc)

    elif schedule_type == "monthly":
        day_of_month = schedule.get("day", 1)  # 1-31
        time_str = schedule.get("time", "00:00")
        hour, minute = parse_time(time_str)

        if last_generated_local is None:
            most_recent_date = now_local.replace(
                day=1,
                hour=hour,
                minute=minute,
                second=0,
                microsecond=0,
            )

            try:
                most_recent_date = most_recent_date.replace(day=day_of_month)
            except ValueError:
                last_day = calendar.monthrange(now_local.year, now_local.month)[1]
                most_recent_date = most_recent_date.replace(day=last_day)

            if most_recent_date <= now_local:
                return most_recent_date.astimezone(timezone.utc)

        # Check if already generated this month
        if (
            last_generated_local
            and last_generated_local.month == now_local.month
            and last_generated_local.year == now_local.year
        ):
            # Already generated this month - calculate next month's date
            if now_local.month == 12:
                target_date = now_local.replace(
                    year=now_local.year + 1,
                    month=1,
                    day=1,
                    hour=hour,
                    minute=minute,
                    second=0,
                    microsecond=0,
                )
            else:
                target_date = now_local.replace(
                    month=now_local.month + 1,
                    day=1,
                    hour=hour,
                    minute=minute,
                    second=0,
                    microsecond=0,
                )

            # Handle day overflow for next month
            try:
                target_date = target_date.replace(day=day_of_month)
            except ValueError:
                last_day = calendar.monthrange(target_date.year, target_date.month)[1]
                target_date = target_date.replace(day=last_day)

            return target_date.astimezone(timezone.utc)

        # Calculate this month's scheduled date
        target_date = now_local.replace(day=1, hour=hour, minute=minute, second=0, microsecond=0)

        # Try setting the target day (handle months with fewer days)
        try:
            target_date = target_date.replace(day=day_of_month)
        except ValueError:
            # Day doesn't exist in this month (e.g., Feb 31) - use last day
            last_day = calendar.monthrange(now_local.year, now_local.month)[1]
            target_date = target_date.replace(day=last_day)

        # If target already passed this month, move to next month
        if target_date <= now_local:
            # Move to next month
            if now_local.month == 12:
                target_date = target_date.replace(year=now_local.year + 1, month=1)
            else:
                target_date = target_date.replace(month=now_local.month + 1)

            # Handle day overflow again for next month
            try:
                target_date = target_date.replace(day=day_of_month)
            except ValueError:
                last_day = calendar.monthrange(target_date.year, target_date.month)[1]
                target_date = target_date.replace(day=last_day)

        return target_date.astimezone(timezone.utc)

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
    Check all active subscriptions and generate overdue instances.

    This function is idempotent - calling it multiple times in the same
    minute won't create duplicates. It skips creation if an incomplete
    instance already exists to prevent quest spam.

    Phase 3: Uses per-user subscriptions instead of template-level schedules.

    Args:
        home_id: The home ID to generate quests for
        session: Database session
    """
    home = session.get(Home, home_id)
    home_timezone = home.timezone if home else "UTC"

    # Get all active recurring subscriptions for users in this home
    # Join with User to filter by home_id
    subscriptions = session.exec(
        select(UserTemplateSubscription)
        .join(User, UserTemplateSubscription.user_id == User.id)
        .where(User.home_id == home_id)
        .where(UserTemplateSubscription.is_active == True)  # noqa: E712
        .where(UserTemplateSubscription.recurrence != "one-off")
        .where(
            # Performance optimization: skip recently generated subscriptions
            or_(
                UserTemplateSubscription.last_generated_at.is_(None),
                UserTemplateSubscription.last_generated_at
                < datetime.now(timezone.utc) - timedelta(hours=1),
            )
        )
    ).all()

    now = datetime.now(timezone.utc)

    for subscription in subscriptions:
        if not subscription.schedule:
            continue  # Skip subscriptions without schedule config

        try:
            schedule = json.loads(subscription.schedule)
            next_generation_time = calculate_next_generation_time(
                subscription.last_generated_at, schedule, home_timezone
            )

            # Check if it's time to generate
            if now >= next_generation_time:
                # Check if incomplete instance already exists for THIS USER (skip if so)
                existing = session.exec(
                    select(Quest)
                    .join(QuestParticipant, QuestParticipant.quest_id == Quest.id)
                    .where(Quest.quest_template_id == subscription.quest_template_id)
                    .where(QuestParticipant.user_id == subscription.user_id)
                    .where(Quest.completed == False)  # noqa: E712
                ).first()

                if existing:
                    continue  # Skip creation to prevent spam

                # Get template for snapshot data
                template = session.get(QuestTemplate, subscription.quest_template_id)
                if not template:
                    continue  # Template was deleted

                # Create new quest instance for THIS USER
                new_quest = Quest(
                    home_id=home_id,
                    created_by=subscription.user_id,
                    user_id=subscription.user_id,
                    quest_template_id=template.id,
                    # Snapshot template data
                    title=template.title,
                    display_name=template.display_name,
                    description=template.description,
                    tags=template.tags,
                    xp_reward=template.xp_reward,
                    gold_reward=template.gold_reward,
                    quest_type="standard",
                    # Snapshot subscription schedule (Phase 3: per-user schedules)
                    recurrence=subscription.recurrence,
                    schedule=subscription.schedule,
                    due_in_hours=subscription.due_in_hours,
                )
                session.add(new_quest)
                session.flush()

                crud_quest.replace_quest_participants(session, new_quest, [subscription.user_id])

                # Update subscription's last_generated_at to prevent duplicate generation
                subscription.last_generated_at = now
                session.add(subscription)

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            # Log error and skip this subscription if schedule is malformed
            print(f"Error processing subscription {subscription.id}: {e}")
            continue

    session.commit()
