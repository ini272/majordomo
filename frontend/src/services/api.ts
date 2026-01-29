import type {
  LoginResponse,
  User,
  Quest,
  QuestTemplate,
  QuestCompleteResponse,
  QuestTemplateCreateRequest,
  QuestTemplateUpdateRequest,
  QuestCreateRequest,
  DailyBounty,
  BountyCheckResponse,
  Achievement,
  UserAchievement,
  Reward,
  UserRewardClaim,
  UserTemplateSubscription,
  UserTemplateSubscriptionCreate,
  UserTemplateSubscriptionUpdate,
} from "../types/api";

// Detect API URL at runtime
// If VITE_API_URL env var is set (from docker-compose or build), use it
// Otherwise, construct from current hostname (replace port 3000 with 8000)
const getAPIURL = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const { hostname, protocol } = window.location;
  return `${protocol}//${hostname}:8000/api`;
};

const API_URL = getAPIURL();

export const api = {
  auth: {
    login: async (homeId: number, username: string, password: string): Promise<LoginResponse> => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home_id: homeId, username, password }),
      });
      if (!res.ok) throw new Error("Login failed");
      return res.json();
    },

    loginEmail: async (email: string, password: string): Promise<LoginResponse> => {
      const res = await fetch(`${API_URL}/auth/login-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail?.message || "Login failed");
      }
      return res.json();
    },

    signup: async (
      email: string,
      username: string,
      password: string,
      homeName: string
    ): Promise<LoginResponse & { invite_code: string }> => {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, home_name: homeName }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail?.message || "Signup failed");
      }
      return res.json();
    },

    join: async (
      inviteCode: string,
      email: string,
      username: string,
      password: string
    ): Promise<LoginResponse> => {
      const res = await fetch(`${API_URL}/auth/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: inviteCode, email, username, password }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail?.message || "Failed to join home");
      }
      return res.json();
    },
  },

  user: {
    getStats: async (token: string): Promise<User> => {
      const res = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch user stats");
      return res.json();
    },
  },

  quests: {
    getAll: async (token: string): Promise<Quest[]> => {
      const res = await fetch(`${API_URL}/quests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch quests");
      return res.json();
    },

    getAllTemplates: async (token: string): Promise<QuestTemplate[]> => {
      const res = await fetch(`${API_URL}/quests/templates/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch quest templates");
      return res.json();
    },

    getTemplate: async (templateId: number, token: string): Promise<QuestTemplate> => {
      const res = await fetch(`${API_URL}/quests/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch quest template");
      return res.json();
    },

    updateTemplate: async (
      templateId: number,
      templateData: QuestTemplateUpdateRequest,
      token: string
    ): Promise<QuestTemplate> => {
      const res = await fetch(`${API_URL}/quests/templates/${templateId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(templateData),
      });
      if (!res.ok) throw new Error("Failed to update quest template");
      return res.json();
    },

    deleteTemplate: async (templateId: number, token: string): Promise<void> => {
      const res = await fetch(`${API_URL}/quests/templates/${templateId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete quest template");
    },

    complete: async (questId: number, token: string): Promise<QuestCompleteResponse> => {
      const res = await fetch(`${API_URL}/quests/${questId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to complete quest");
      return res.json();
    },

    createTemplate: async (
      templateData: QuestTemplateCreateRequest,
      token: string,
      createdBy: number,
      skipAI: boolean = false
    ): Promise<QuestTemplate> => {
      const res = await fetch(
        `${API_URL}/quests/templates?created_by=${createdBy}&skip_ai=${skipAI}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(templateData),
        }
      );
      if (!res.ok) throw new Error("Failed to create quest template");
      return res.json();
    },

    create: async (
      questData: QuestCreateRequest,
      token: string,
      userId: number
    ): Promise<Quest> => {
      const res = await fetch(`${API_URL}/quests?user_id=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(questData),
      });
      if (!res.ok) throw new Error("Failed to create quest");
      return res.json();
    },
  },

  triggers: {
    quest: async (
      questTemplateId: number,
      token: string
    ): Promise<
      QuestCompleteResponse & { user_stats: { level: number; xp: number; gold: number } }
    > => {
      const res = await fetch(`${API_URL}/triggers/quest/${questTemplateId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to trigger quest");
      return res.json();
    },
  },

  bounty: {
    getToday: async (token: string): Promise<DailyBounty | null> => {
      const res = await fetch(`${API_URL}/bounty/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch daily bounty");
      return res.json();
    },

    refresh: async (token: string): Promise<DailyBounty> => {
      const res = await fetch(`${API_URL}/bounty/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to refresh daily bounty");
      return res.json();
    },

    checkTemplate: async (templateId: number, token: string): Promise<BountyCheckResponse> => {
      const res = await fetch(`${API_URL}/bounty/check/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to check bounty status");
      return res.json();
    },
  },

  home: {
    getInviteCode: async (
      homeId: number,
      token: string
    ): Promise<{ invite_code: string; home_name: string }> => {
      const res = await fetch(`${API_URL}/homes/${homeId}/invite-code`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch invite code");
      return res.json();
    },
  },

  achievements: {
    getAll: async (token: string): Promise<Achievement[]> => {
      const res = await fetch(`${API_URL}/achievements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch achievements");
      return res.json();
    },

    getMyAchievements: async (token: string): Promise<UserAchievement[]> => {
      const res = await fetch(`${API_URL}/achievements/me/achievements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch user achievements");
      return res.json();
    },
  },

  rewards: {
    getAll: async (token: string): Promise<Reward[]> => {
      const res = await fetch(`${API_URL}/rewards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch rewards");
      return res.json();
    },

    claim: async (rewardId: number, userId: number, token: string): Promise<UserRewardClaim> => {
      const res = await fetch(`${API_URL}/rewards/${rewardId}/claim?user_id=${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail?.message || "Failed to claim reward");
      }
      return res.json();
    },

    getUserClaims: async (userId: number, token: string): Promise<UserRewardClaim[]> => {
      const res = await fetch(`${API_URL}/rewards/user/${userId}/claims`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch reward claims");
      return res.json();
    },
  },

  subscriptions: {
    getAll: async (token: string): Promise<UserTemplateSubscription[]> => {
      const res = await fetch(`${API_URL}/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch subscriptions");
      return res.json();
    },

    create: async (
      subscriptionData: UserTemplateSubscriptionCreate,
      token: string
    ): Promise<UserTemplateSubscription> => {
      const res = await fetch(`${API_URL}/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(subscriptionData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to create subscription");
      }
      return res.json();
    },

    update: async (
      subscriptionId: number,
      subscriptionData: UserTemplateSubscriptionUpdate,
      token: string
    ): Promise<UserTemplateSubscription> => {
      const res = await fetch(`${API_URL}/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(subscriptionData),
      });
      if (!res.ok) throw new Error("Failed to update subscription");
      return res.json();
    },

    delete: async (subscriptionId: number, token: string): Promise<void> => {
      const res = await fetch(`${API_URL}/subscriptions/${subscriptionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete subscription");
    },
  },
};
