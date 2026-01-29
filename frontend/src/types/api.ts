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
  created_by: number;
  created_at: string;
}

export interface Quest {
  id: number;
  home_id: number;
  user_id: number;
  quest_template_id: number | null;  // Nullable for standalone quests
  completed: boolean;
  created_at: string;
  completed_at: string | null;

  // Snapshot fields (copied from template at creation)
  title: string;
  display_name: string | null;
  description: string | null;
  tags: string | null;
  xp_reward: number;  // Base at creation, actual earned after completion
  gold_reward: number;

  quest_type: string;
  due_date: string | null;
  corrupted_at: string | null;
  template: QuestTemplate | null;  // Null for standalone quests
}

export interface User {
  id: number;
  home_id: number;
  username: string;
  gold_balance: number;
  xp: number;
  level: number;
  active_xp_boost_count: number;
  active_shield_expiry: string | null;
}

export interface DailyBounty {
  id: number;
  home_id: number;
  quest_template_id: number;
  date: string;
  created_at: string;
  template: QuestTemplate;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  home_id: number;
}

export interface QuestCompleteResponse {
  quest: Quest;
  rewards: {
    xp: number;
    gold: number;
    is_daily_bounty: boolean;
    is_corrupted: boolean;
    multiplier: number;
  };
}

export interface BountyCheckResponse {
  is_bounty: boolean;
  quest_template_id: number;
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
}

export interface QuestCreateRequest {
  quest_template_id: number;
  due_date?: string | null;
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
