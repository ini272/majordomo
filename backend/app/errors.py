"""
Error codes and standardized error responses for the Majordomo API.

This module provides:
- Error code constants for consistent error handling
- Error response models for structured API responses
- Helper functions for creating error responses
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class ErrorCode(str, Enum):
    """Standard error codes for API responses"""

    # Resource not found errors (404)
    QUEST_NOT_FOUND = "QUEST_NOT_FOUND"
    QUEST_TEMPLATE_NOT_FOUND = "QUEST_TEMPLATE_NOT_FOUND"
    USER_NOT_FOUND = "USER_NOT_FOUND"
    HOME_NOT_FOUND = "HOME_NOT_FOUND"
    REWARD_NOT_FOUND = "REWARD_NOT_FOUND"
    ACHIEVEMENT_NOT_FOUND = "ACHIEVEMENT_NOT_FOUND"
    BOUNTY_NOT_FOUND = "BOUNTY_NOT_FOUND"

    # Validation errors (400)
    INVALID_INPUT = "INVALID_INPUT"
    DUPLICATE_HOME_NAME = "DUPLICATE_HOME_NAME"
    DUPLICATE_USERNAME = "DUPLICATE_USERNAME"
    NEGATIVE_XP = "NEGATIVE_XP"
    INSUFFICIENT_GOLD = "INSUFFICIENT_GOLD"
    NEGATIVE_AMOUNT = "NEGATIVE_AMOUNT"

    # State errors (400)
    QUEST_ALREADY_COMPLETED = "QUEST_ALREADY_COMPLETED"
    ACHIEVEMENT_ALREADY_UNLOCKED = "ACHIEVEMENT_ALREADY_UNLOCKED"

    # Authorization errors (403)
    UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS"
    FORBIDDEN = "FORBIDDEN"

    # Authentication errors (401)
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    MISSING_TOKEN = "MISSING_TOKEN"
    INVALID_TOKEN = "INVALID_TOKEN"


class ErrorDetail(BaseModel):
    """Detailed error information"""

    code: ErrorCode
    message: str
    details: Optional[dict] = None


class ErrorResponse(BaseModel):
    """Standardized error response"""

    error: ErrorDetail


# Error message templates
ERROR_MESSAGES = {
    ErrorCode.QUEST_NOT_FOUND: "Quest not found",
    ErrorCode.QUEST_TEMPLATE_NOT_FOUND: "Quest template not found",
    ErrorCode.USER_NOT_FOUND: "User not found",
    ErrorCode.HOME_NOT_FOUND: "Home not found",
    ErrorCode.REWARD_NOT_FOUND: "Reward not found",
    ErrorCode.ACHIEVEMENT_NOT_FOUND: "Achievement not found",
    ErrorCode.BOUNTY_NOT_FOUND: "Daily bounty not found",
    ErrorCode.INVALID_INPUT: "Invalid input provided",
    ErrorCode.DUPLICATE_HOME_NAME: "A home with this name already exists",
    ErrorCode.DUPLICATE_USERNAME: "Username already exists in this home",
    ErrorCode.NEGATIVE_XP: "XP amount cannot be negative",
    ErrorCode.INSUFFICIENT_GOLD: "Insufficient gold balance",
    ErrorCode.NEGATIVE_AMOUNT: "Amount cannot be negative",
    ErrorCode.QUEST_ALREADY_COMPLETED: "Quest is already completed",
    ErrorCode.ACHIEVEMENT_ALREADY_UNLOCKED: "Achievement already unlocked",
    ErrorCode.UNAUTHORIZED_ACCESS: "You are not authorized to access this resource",
    ErrorCode.FORBIDDEN: "Access forbidden",
    ErrorCode.INVALID_CREDENTIALS: "Invalid username or password",
    ErrorCode.MISSING_TOKEN: "Authentication token is missing",
    ErrorCode.INVALID_TOKEN: "Authentication token is invalid",
}


def create_error_detail(code: ErrorCode, message: Optional[str] = None, details: Optional[dict] = None) -> dict:
    """
    Create a standardized error detail dictionary.

    Args:
        code: Error code from ErrorCode enum
        message: Optional custom message (defaults to template message)
        details: Optional additional details dict

    Returns:
        Dict with error detail in format: {"detail": {"code": "...", "message": "...", "details": {...}}}
    """
    return {
        "detail": {
            "code": code.value,
            "message": message or ERROR_MESSAGES.get(code, "An error occurred"),
            "details": details or {},
        }
    }


def create_simple_error(message: str) -> dict:
    """
    Create a simple error response (backward compatible with existing error format).

    Args:
        message: Error message

    Returns:
        Dict with error message in format: {"detail": "message"}
    """
    return {"detail": message}
