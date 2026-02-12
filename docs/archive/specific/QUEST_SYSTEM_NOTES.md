# Quest System Architecture Notes

## Status
This document contains phase-specific notes and may not fully match current runtime behavior. Verify against OpenAPI and code before implementation decisions.

## Quest Creation Flow

### Path A: Template-Based (Reusable)
1. User selects existing template from list
2. POST /quests with template_id
3. Quest instance created

### Path B: AI Scribe (One-Off)
1. User enters quest title
2. POST /quests/templates creates **system-generated template** with `system=true`
3. POST /quests creates quest instance linking to system template
4. Groq AI runs in background, generates content for template
5. User can edit template via PUT /quests/templates/{id} with sliders/fields
6. User can later "promote" system template to reusable (future feature)

## Database Schema Issue
**Current:** `quest.quest_template_id` is NOT NULL - every quest needs a template
**Workaround:** Use system-generated placeholder templates for one-offs
**Future Refactor:** Make quest_template_id nullable so one-off quests don't need dummy templates

## Quest Template Fields
- `id`, `home_id`, `created_by`, `created_at`
- `title`, `display_name`, `description`, `tags`
- `xp_reward`, `gold_reward`
- `quest_type` (standard, corrupted, bounty)
- `recurrence` (one-off, daily, weekly)
- `system` (true = AI-generated, false = user-created)

## XP Calculation Formula
```
base_xp = (time + effort + dread) * 2
base_gold = base_xp / 2
```
Where time, effort, dread are 1-5 scales (estimated by Groq or entered by user)

## API Endpoints Needed
- [x] POST /quests/templates (create)
- [x] GET /quests/templates (list)
- [x] GET /quests/templates/{id} (get)
- [ ] PUT /quests/templates/{id} (update - needed for scribe editing)
- [x] POST /quests (create instance)
- [x] GET /quests (list)
- [x] POST /quests/{id}/complete
- [x] PUT /quests/{id} (update - only completed flag)
