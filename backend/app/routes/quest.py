from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from app.database import get_db
from app.models.quest import Quest, QuestCreate, QuestRead, QuestUpdate, QuestTemplate, QuestTemplateRead, QuestTemplateCreate
from app.crud import quest as crud_quest
from app.crud import quest_template as crud_quest_template
from app.crud import user as crud_user

router = APIRouter(prefix="/api/quests", tags=["quests"])


# GET endpoints
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
    home_id: int = Query(...),
    completed: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    """Get all quests for a user, optionally filtered by completion status"""
    # Verify user exists in home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != home_id:
        raise HTTPException(status_code=404, detail="User not found in home")
    
    return crud_quest.get_quests_by_user(db, home_id, user_id, completed)


@router.get("/templates/{template_id}", response_model=QuestTemplateRead)
def get_quest_template(template_id: int, db: Session = Depends(get_db)):
    """Get quest template by ID"""
    template = crud_quest_template.get_quest_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Quest template not found")
    
    return template


@router.get("/templates/home/{home_id}", response_model=List[QuestTemplateRead])
def get_home_quest_templates(home_id: int, system: Optional[bool] = Query(None), db: Session = Depends(get_db)):
    """Get all quest templates in a home"""
    return crud_quest_template.get_home_quest_templates(db, home_id, system)


# POST endpoints
@router.post("", response_model=QuestRead)
def create_quest(quest: QuestCreate, home_id: int = Query(...), user_id: int = Query(...), db: Session = Depends(get_db)):
    """Create a new quest instance for a user"""
    # Verify user exists in home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != home_id:
        raise HTTPException(status_code=404, detail="User not found in home")
    
    # Verify template exists in home
    template = crud_quest_template.get_quest_template(db, quest.quest_template_id)
    if not template or template.home_id != home_id:
        raise HTTPException(status_code=404, detail="Quest template not found in home")
    
    return crud_quest.create_quest(db, home_id, user_id, quest)


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
    
    # Award XP and gold to user from template
    if quest.template:
        crud_user.add_xp(db, quest.user_id, quest.template.xp_reward)
        crud_user.add_gold(db, quest.user_id, quest.template.gold_reward)
    
    return quest


@router.post("/templates", response_model=QuestTemplateRead)
def create_quest_template(home_id: int = Query(...), created_by: int = Query(...), template: QuestTemplateCreate = None, db: Session = Depends(get_db)):
    """Create a new quest template"""
    # Verify user exists in home
    user = crud_user.get_user(db, created_by)
    if not user or user.home_id != home_id:
        raise HTTPException(status_code=404, detail="User not found in home")
    
    return crud_quest_template.create_quest_template(db, home_id, created_by, template)


# PUT endpoints
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


# DELETE endpoints
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
