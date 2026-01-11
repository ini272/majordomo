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
    login: async (
      homeId: number,
      username: string,
      password: string
    ): Promise<LoginResponse> => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home_id: homeId, username, password }),
      });
      if (!res.ok) throw new Error("Login failed");
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

    getTemplate: async (
      templateId: number,
      token: string
    ): Promise<QuestTemplate> => {
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

    complete: async (
      questId: number,
      token: string
    ): Promise<QuestCompleteResponse> => {
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
    ): Promise<QuestCompleteResponse & { user_stats: { level: number; xp: number; gold: number } }> => {
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

    checkTemplate: async (
      templateId: number,
      token: string
    ): Promise<BountyCheckResponse> => {
      const res = await fetch(`${API_URL}/bounty/check/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to check bounty status");
      return res.json();
    },
  },
};
