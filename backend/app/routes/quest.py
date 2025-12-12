from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from app.database import get_db
from app.models.quest import Quest, QuestCreate, QuestRead, QuestUpdate
from app.crud import quest as crud_quest
from app.crud import user as crud_user

router = APIRouter(prefix="/api/quests", tags=["quests"])


@router.post("", response_model=QuestRead)
def create_quest(quest: QuestCreate, user_id: int = Query(...), db: Session = Depends(get_db)):
    """Create a new quest for a user"""
    # Verify user exists
    if not crud_user.get_user(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    
    return crud_quest.create_quest(db, user_id, quest)


@router.get("", response_model=List[QuestRead])
def get_all_quests(db: Session = Depends(get_db)):
    """Get all quests"""
    return crud_quest.get_all_quests(db)


@router.get("/{quest_id}", response_model=QuestRead)
def get_quest(quest_id: int, user_id: int = Query(...), db: Session = Depends(get_db)):
    """Get quest by ID (only owner can access)"""
    quest = crud_quest.get_quest(db, quest_id)
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    
    # Verify ownership
    if quest.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this quest")
    
    return quest


@router.get("/user/{user_id}", response_model=List[QuestRead])
def get_user_quests(
    user_id: int,
    completed: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    """Get all quests for a user, optionally filtered by completion status"""
    # Verify user exists
    if not crud_user.get_user(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    
    return crud_quest.get_quests_by_user(db, user_id, completed)


@router.put("/{quest_id}", response_model=QuestRead)
def update_quest(quest_id: int, user_id: int = Query(...), quest_update: QuestUpdate = None, db: Session = Depends(get_db)):
    """Update quest (only owner can update)"""
    quest = crud_quest.get_quest(db, quest_id)
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    
    # Verify ownership
    if quest.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this quest")
    
    quest = crud_quest.update_quest(db, quest_id, quest_update)
    return quest


@router.post("/{quest_id}/complete", response_model=QuestRead)
def complete_quest(quest_id: int, user_id: int = Query(...), db: Session = Depends(get_db)):
    """Mark quest as completed and award XP/gold to user (only owner)"""
    quest = crud_quest.get_quest(db, quest_id)
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    
    # Verify ownership
    if quest.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to complete this quest")
    
    # Prevent double-completion
    if quest.completed:
        raise HTTPException(status_code=400, detail="Quest is already completed")
    
    # Mark quest as completed
    quest = crud_quest.complete_quest(db, quest_id)
    
    # Award XP and gold to user
    crud_user.add_xp(db, quest.user_id, quest.xp_reward)
    crud_user.add_gold(db, quest.user_id, quest.gold_reward)
    
    return quest


@router.delete("/{quest_id}")
def delete_quest(quest_id: int, user_id: int = Query(...), db: Session = Depends(get_db)):
    """Delete quest (only owner can delete)"""
    quest = crud_quest.get_quest(db, quest_id)
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    
    # Verify ownership
    if quest.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this quest")
    
    crud_quest.delete_quest(db, quest_id)
    return {"detail": "Quest deleted"}
