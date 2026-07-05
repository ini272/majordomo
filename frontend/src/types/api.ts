// API response types matching backend SQLModel schemas

export interface QuestTemplate {
  id: number;
  home_id: number;
  title: string;
  display_name: string | null;
  description: string | null;
  tags: string | null;
  xp_reward: number;
  gold_reward: number;
  quest_type: string;
  recurrence: string;
  schedule: string | null;
  last_generated_at: string | null;
  due_in_hours: number | null;
  system: boolean;
  nfc_enabled: boolean;
  nfc_code: string | null;
  created_by: number;
  created_at: string;
}

export interface Quest {
  id: number;
  home_id: number;
  user_id: number;
  created_by: number;
  quest_template_id: number | null; // Nullable for standalone quests
  completed: boolean;
  created_at: string;
  completed_at: string | null;

  // Snapshot fields (copied from template at creation)
  title: string;
  display_name: string | null;
  description: string | null;
  tags: string | null;
  xp_reward: number; // Base reward awarded to each participant
  gold_reward: number;
  recurrence: string; // Snapshot of recurrence when quest was created
  schedule: string | null; // Snapshot of schedule when quest was created

  quest_type: string;
  due_in_hours: number | null; // Corruption timer configuration for this quest
  due_date: string | null; // Absolute corruption deadline when an active quest timer has been edited
  corrupted_at: string | null;
  effective_xp_reward: number | null; // Current user's reward preview after household corruption
  effective_gold_reward: number | null;
  corruption_debuff: number | null;
  corrupted_quest_count: number;
  corruption_debuff_active: boolean;
  template: QuestTemplate | null; // Null for standalone quests
  participants: QuestParticipant[];
}

export interface QuestScribePreview {
  display_name: string;
  description: string;
  tags: string;
}

export interface QuestParticipant {
  id: number;
  quest_id: number;
  user_id: number;
  xp_awarded: number | null;
  gold_awarded: number | null;
  completed_at: string | null;
  created_at: string;
}

export interface User {
  id: number;
  home_id: number;
  username: string;
  email: string | null;
  gold_balance: number;
  xp: number;
  level: number;
  created_at: string;
  active_xp_boost_count: number;
  active_shield_expiry: string | null;
}

export interface Home {
  id: number;
  name: string;
  invite_code: string;
  timezone: string;
  created_at: string;
}

export interface DailyBounty {
  bounty_date: string;
  status: "assigned" | "none_eligible";
  bonus_multiplier: number;
  quest: Quest | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  home_id: number;
}

export interface DetailResponse {
  detail: string;
}

export interface QuestCompleteResponse {
  quest: Quest;
  rewards: {
    xp: number;
    gold: number;
    base_xp?: number;
    base_gold?: number;
    is_daily_bounty: boolean;
    is_corrupted: boolean;
    corruption_debuff?: number;
    bounty_multiplier: number;
    bounty_gold_multiplier?: number;
    bounty_xp_multiplier?: number;
    xp_boost_active?: boolean;
    xp_boost_remaining?: number;
    participants?: QuestParticipantReward[];
    duplicate_scan?: boolean;
    previous_xp?: number;
    previous_gold?: number;
  };
  achievements?: Array<{
    user_id: number;
    id: number;
    unlocked_at: string;
  }>;
}

export interface TriggerQuestResponse extends QuestCompleteResponse {
  success: boolean;
  duplicate: boolean;
  source: "active_quest" | "created_from_template" | "cooldown";
  cooldown_seconds: number;
  cooldown_remaining_seconds?: number;
  user_stats: {
    level: number;
    xp: number;
    gold: number;
  };
}

export interface QuestParticipantReward {
  user_id: number;
  xp: number;
  gold: number;
  base_xp: number;
  base_gold: number;
  is_daily_bounty: boolean;
  is_corrupted: boolean;
  corruption_debuff: number;
  bounty_multiplier: number;
  bounty_gold_multiplier: number;
  bounty_xp_multiplier: number;
  xp_boost_active: boolean;
  xp_boost_remaining: number;
}

export interface BountyCheckResponse {
  is_daily_bounty: boolean;
  bonus_multiplier: number;
}

// Request types
export interface QuestTemplateCreateRequest {
  title: string;
  display_name?: string;
  description?: string;
  tags?: string;
  xp_reward?: number;
  gold_reward?: number;
  quest_type?: string;
  recurrence?: string;
  schedule?: string | null;
  due_in_hours?: number | null;
  nfc_enabled?: boolean;
  nfc_code?: string | null;
}

export interface QuestTemplateUpdateRequest {
  display_name?: string;
  description?: string;
  tags?: string;
  xp_reward?: number;
  gold_reward?: number;
  quest_type?: string;
  recurrence?: string;
  schedule?: string | null;
  due_in_hours?: number | null;
  nfc_enabled?: boolean;
  nfc_code?: string | null;
}

export interface QuestCreateRequest {
  quest_template_id: number;
  due_date?: string | null;
  participant_user_ids?: number[];
}

export interface UserProfileUpdateRequest {
  username?: string;
  email?: string;
}

export interface HomeUpdateRequest {
  name?: string;
  timezone?: string;
}

export interface Achievement {
  id: number;
  home_id: number | null;
  is_system: boolean;
  name: string;
  description: string | null;
  criteria_type: string;
  criteria_value: number;
  icon: string | null;
  created_at: string;
}

export interface UserAchievement {
  id: number;
  user_id: number;
  achievement_id: number;
  unlocked_at: string;
  achievement: Achievement;
}

export interface Reward {
  id: number;
  home_id: number;
  name: string;
  description: string | null;
  cost: number;
  created_at: string;
}

export interface UserRewardClaim {
  id: number;
  user_id: number;
  reward_id: number;
  claimed_at: string;
}

export interface UserTemplateSubscription {
  id: number;
  user_id: number;
  quest_template_id: number;
  recurrence: string;
  schedule: string | null;
  due_in_hours: number | null;
  last_generated_at: string | null;
  is_active: boolean;
}

export interface UpcomingSubscription extends UserTemplateSubscription {
  created_at: string;
  next_spawn_at: string;
  template: QuestTemplate;
}

export interface UserTemplateSubscriptionCreate {
  quest_template_id: number;
  recurrence: string;
  schedule?: string | null;
  due_in_hours?: number | null;
}

export interface UserTemplateSubscriptionUpdate {
  recurrence?: string;
  schedule?: string | null;
  due_in_hours?: number | null;
  is_active?: boolean;
}

export interface ConvertToTemplateRequest {
  recurrence: string;
  schedule?: string | null;
  due_in_hours?: number | null;
}
