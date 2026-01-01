from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlmodel import Session
from app.database import get_db
from app.models.quest import Quest, QuestCreate, QuestRead, QuestUpdate, QuestTemplate, QuestTemplateRead, QuestTemplateCreate, QuestTemplateUpdate
from app.crud import quest as crud_quest
from app.crud import quest_template as crud_quest_template
from app.crud import user as crud_user
from app.auth import get_current_user
from app.services.scribe import generate_quest_content

router = APIRouter(prefix="/api/quests", tags=["quests"])


# GET endpoints
@router.get("/templates/all", response_model=List[QuestTemplateRead])
def get_all_quest_templates(db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get all quest templates in the authenticated user's home"""
    return crud_quest_template.get_home_quest_templates(db, auth["home_id"])


@router.get("", response_model=List[QuestRead])
def get_all_quests(db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get all quests in authenticated user's home"""
    return crud_quest.get_quests_by_home(db, auth["home_id"])


@router.get("/{quest_id}", response_model=QuestRead)
def get_quest(quest_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get quest by ID (only those in your home can access)"""
    quest = crud_quest.get_quest(db, quest_id)
    if not quest or quest.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Quest not found")
    
    return quest


@router.get("/user/{user_id}", response_model=List[QuestRead])
def get_user_quests(
    user_id: int,
    completed: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    auth: Dict = Depends(get_current_user)
):
    """Get all quests for a user, optionally filtered by completion status"""
    # Verify user exists in authenticated home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="User not found in home")
    
    return crud_quest.get_quests_by_user(db, auth["home_id"], user_id, completed)


@router.get("/templates/{template_id}", response_model=QuestTemplateRead)
def get_quest_template(template_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Get quest template by ID"""
    template = crud_quest_template.get_quest_template(db, template_id)
    if not template or template.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Quest template not found")
    
    return template


# POST endpoints
@router.post("", response_model=QuestRead)
def create_quest(quest: QuestCreate, user_id: int = Query(...), db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Create a new quest instance for a user"""
    home_id = auth["home_id"]
    
    # Verify user exists in home and belongs to authenticated home
    user = crud_user.get_user(db, user_id)
    if not user or user.home_id != home_id:
        raise HTTPException(status_code=404, detail="User not found in home")
    
    # Verify template exists in home
    template = crud_quest_template.get_quest_template(db, quest.quest_template_id)
    if not template or template.home_id != home_id:
        raise HTTPException(status_code=404, detail="Quest template not found in home")
    
    return crud_quest.create_quest(db, home_id, user_id, quest)


@router.post("/{quest_id}/complete", response_model=QuestRead)
def complete_quest(quest_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Mark quest as completed and award XP/gold to user"""
    quest = crud_quest.get_quest(db, quest_id)
    if not quest or quest.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Quest not found")
    
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


def _generate_and_update_quest_template(template_id: int, quest_title: str):
    """Background task to generate quest content and update template"""
    import time
    time.sleep(0.5)  # Small delay to ensure template is committed
    
    try:
        from app.database import engine
        from sqlmodel import Session
        
        # Generate content using Groq
        scribe_response = generate_quest_content(quest_title)
        if not scribe_response:
            return  # Silently fail if Groq unavailable

        # Update template with generated content
        with Session(engine) as db:
            template = crud_quest_template.get_quest_template(db, template_id)
            if not template:
                return

            # Only update if fields are empty (don't override user input)
            if not template.display_name:
                template.display_name = scribe_response.display_name
            if not template.description:
                template.description = scribe_response.description
            if not template.tags:
                template.tags = scribe_response.tags

            # Always update rewards based on calculated values
            template.xp_reward = scribe_response.calculate_xp()
            template.gold_reward = scribe_response.calculate_gold()

            db.add(template)
            db.commit()
    except Exception as e:
        import logging
        logging.error(f"Error in scribe background task: {e}")


@router.post("/templates", response_model=QuestTemplateRead)
def create_quest_template(
    created_by: int = Query(...),
    template: QuestTemplateCreate = None,
    db: Session = Depends(get_db),
    auth: Dict = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Create a new quest template and generate content asynchronously"""
    home_id = auth["home_id"]

    # Verify user exists in home
    user = crud_user.get_user(db, created_by)
    if not user or user.home_id != home_id:
        raise HTTPException(status_code=404, detail="User not found in home")

    # Create template with defaults
    new_template = crud_quest_template.create_quest_template(db, home_id, created_by, template)

    # Trigger background task to generate content from Groq
    background_tasks.add_task(
        _generate_and_update_quest_template,
        template_id=new_template.id,
        quest_title=new_template.title,
    )

    return new_template


# PUT endpoints
@router.put("/templates/{template_id}", response_model=QuestTemplateRead)
def update_quest_template(template_id: int, template_update: QuestTemplateUpdate = None, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Update quest template"""
    template = crud_quest_template.get_quest_template(db, template_id)
    if not template or template.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Quest template not found")
    
    template = crud_quest_template.update_quest_template(db, template_id, template_update)
    return template


@router.put("/{quest_id}", response_model=QuestRead)
def update_quest(quest_id: int, quest_update: QuestUpdate = None, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Update quest"""
    quest = crud_quest.get_quest(db, quest_id)
    if not quest or quest.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Quest not found")
    
    quest = crud_quest.update_quest(db, quest_id, quest_update)
    return quest


# DELETE endpoints
@router.delete("/{quest_id}")
def delete_quest(quest_id: int, db: Session = Depends(get_db), auth: Dict = Depends(get_current_user)):
    """Delete quest"""
    quest = crud_quest.get_quest(db, quest_id)
    if not quest or quest.home_id != auth["home_id"]:
        raise HTTPException(status_code=404, detail="Quest not found")
    
    crud_quest.delete_quest(db, quest_id)
    return {"detail": "Quest deleted"}
