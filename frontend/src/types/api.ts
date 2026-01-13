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
  system: boolean;
  created_by: number;
  created_at: string;
}

export interface Quest {
  id: number;
  home_id: number;
  user_id: number;
  quest_template_id: number;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
  quest_type: string;
  due_date: string | null;
  corrupted_at: string | null;
  template: QuestTemplate;
}

export interface User {
  id: number;
  home_id: number;
  username: string;
  gold_balance: number;
  xp: number;
  level: number;
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
}

export interface QuestTemplateUpdateRequest {
  display_name?: string;
  description?: string;
  tags?: string;
  xp_reward?: number;
  gold_reward?: number;
  quest_type?: string;
  recurrence?: string;
}

export interface QuestCreateRequest {
  quest_template_id: number;
  due_date?: string | null;
}
