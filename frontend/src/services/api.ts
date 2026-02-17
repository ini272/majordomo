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
  UpcomingSubscription,
  ConvertToTemplateRequest,
} from "../types/api";

const getAPIURL = (): string => {
  if (import.meta.env.VITE_API_URL) {
    const configuredUrl = import.meta.env.VITE_API_URL.trim().replace(/\/+$/, "");
    return configuredUrl.endsWith("/api") ? configuredUrl : `${configuredUrl}/api`;
  }

  const { hostname, protocol } = window.location;
  return `${protocol}//${hostname}:8000/api`;
};

const API_URL = getAPIURL();

const buildHeaders = (token?: string, contentType: boolean = false): HeadersInit => {
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (!error || typeof error !== "object") return fallback;

  const maybeError = error as { detail?: unknown };
  if (typeof maybeError.detail === "string") return maybeError.detail;

  if (maybeError.detail && typeof maybeError.detail === "object") {
    const message = (maybeError.detail as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return fallback;
};

const requestJSON = async <T>(path: string, options: RequestInit = {}, fallbackError: string): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    try {
      const error = await res.json();
      throw new Error(extractErrorMessage(error, fallbackError));
    } catch {
      throw new Error(fallbackError);
    }
  }

  return res.json();
};

const requestVoid = async (path: string, options: RequestInit = {}, fallbackError: string): Promise<void> => {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) throw new Error(fallbackError);
};

export const api = {
  auth: {
    login: async (homeId: number, username: string, password: string): Promise<LoginResponse> =>
      requestJSON<LoginResponse>(
        "/auth/login",
        {
          method: "POST",
          headers: buildHeaders(undefined, true),
          body: JSON.stringify({ home_id: homeId, username, password }),
        },
        "Login failed"
      ),

    loginEmail: async (email: string, password: string): Promise<LoginResponse> =>
      requestJSON<LoginResponse>(
        "/auth/login-email",
        {
          method: "POST",
          headers: buildHeaders(undefined, true),
          body: JSON.stringify({ email, password }),
        },
        "Login failed"
      ),

    signup: async (
      email: string,
      username: string,
      password: string,
      homeName: string,
      homeTimezone?: string
    ): Promise<LoginResponse & { invite_code: string }> =>
      requestJSON<LoginResponse & { invite_code: string }>(
        "/auth/signup",
        {
          method: "POST",
          headers: buildHeaders(undefined, true),
          body: JSON.stringify({
            email,
            username,
            password,
            home_name: homeName,
            home_timezone: homeTimezone ?? "UTC",
          }),
        },
        "Signup failed"
      ),

    join: async (
      inviteCode: string,
      email: string,
      username: string,
      password: string
    ): Promise<LoginResponse> =>
      requestJSON<LoginResponse>(
        "/auth/join",
        {
          method: "POST",
          headers: buildHeaders(undefined, true),
          body: JSON.stringify({ invite_code: inviteCode, email, username, password }),
        },
        "Failed to join home"
      ),
  },

  user: {
    getStats: async (token: string): Promise<User> =>
      requestJSON<User>("/users/me", { headers: buildHeaders(token) }, "Failed to fetch user stats"),
  },

  quests: {
    getAll: async (token: string): Promise<Quest[]> =>
      requestJSON<Quest[]>("/quests", { headers: buildHeaders(token) }, "Failed to fetch quests"),

    getAllTemplates: async (token: string): Promise<QuestTemplate[]> =>
      requestJSON<QuestTemplate[]>(
        "/quests/templates/all",
        { headers: buildHeaders(token) },
        "Failed to fetch quest templates"
      ),

    getTemplate: async (templateId: number, token: string): Promise<QuestTemplate> =>
      requestJSON<QuestTemplate>(
        `/quests/templates/${templateId}`,
        { headers: buildHeaders(token) },
        "Failed to fetch quest template"
      ),

    updateTemplate: async (
      templateId: number,
      templateData: QuestTemplateUpdateRequest,
      token: string
    ): Promise<QuestTemplate> =>
      requestJSON<QuestTemplate>(
        `/quests/templates/${templateId}`,
        {
          method: "PUT",
          headers: buildHeaders(token, true),
          body: JSON.stringify(templateData),
        },
        "Failed to update quest template"
      ),

    deleteTemplate: async (templateId: number, token: string): Promise<void> =>
      requestVoid(
        `/quests/templates/${templateId}`,
        { method: "DELETE", headers: buildHeaders(token) },
        "Failed to delete quest template"
      ),

    createAIScribe: async (
      questData: {
        title: string;
        tags?: string;
        xp_reward?: number;
        gold_reward?: number;
      },
      token: string,
      userId: number,
      skipAI: boolean = false
    ): Promise<Quest> =>
      requestJSON<Quest>(
        `/quests/ai-scribe?user_id=${userId}&skip_ai=${skipAI}`,
        {
          method: "POST",
          headers: buildHeaders(token, true),
          body: JSON.stringify(questData),
        },
        "Failed to create AI Scribe quest"
      ),

    createRandom: async (token: string, userId: number): Promise<Quest> =>
      requestJSON<Quest>(
        `/quests/random?user_id=${userId}`,
        {
          method: "POST",
          headers: buildHeaders(token),
        },
        "Failed to create random quest"
      ),

    convertToTemplate: async (
      questId: number,
      conversionData: ConvertToTemplateRequest,
      token: string
    ): Promise<QuestTemplate> =>
      requestJSON<QuestTemplate>(
        `/quests/${questId}/convert-to-template`,
        {
          method: "POST",
          headers: buildHeaders(token, true),
          body: JSON.stringify(conversionData),
        },
        "Failed to convert quest to template"
      ),

    getQuest: async (questId: number, token: string): Promise<Quest> =>
      requestJSON<Quest>(`/quests/${questId}`, { headers: buildHeaders(token) }, "Failed to fetch quest"),

    update: async (
      questId: number,
      questData: {
        display_name?: string;
        description?: string;
        tags?: string;
        xp_reward?: number;
        gold_reward?: number;
      },
      token: string
    ): Promise<Quest> =>
      requestJSON<Quest>(
        `/quests/${questId}`,
        {
          method: "PUT",
          headers: buildHeaders(token, true),
          body: JSON.stringify(questData),
        },
        "Failed to update quest"
      ),

    complete: async (questId: number, token: string): Promise<QuestCompleteResponse> =>
      requestJSON<QuestCompleteResponse>(
        `/quests/${questId}/complete`,
        {
          method: "POST",
          headers: buildHeaders(token),
        },
        "Failed to complete quest"
      ),

    delete: async (questId: number, token: string): Promise<void> =>
      requestVoid(
        `/quests/${questId}`,
        { method: "DELETE", headers: buildHeaders(token) },
        "Failed to delete quest"
      ),

    createTemplate: async (
      templateData: QuestTemplateCreateRequest,
      token: string,
      createdBy: number,
      skipAI: boolean = false
    ): Promise<QuestTemplate> =>
      requestJSON<QuestTemplate>(
        `/quests/templates?created_by=${createdBy}&skip_ai=${skipAI}`,
        {
          method: "POST",
          headers: buildHeaders(token, true),
          body: JSON.stringify(templateData),
        },
        "Failed to create quest template"
      ),

    create: async (
      questData: QuestCreateRequest,
      token: string,
      userId: number
    ): Promise<Quest> =>
      requestJSON<Quest>(
        `/quests?user_id=${userId}`,
        {
          method: "POST",
          headers: buildHeaders(token, true),
          body: JSON.stringify(questData),
        },
        "Failed to create quest"
      ),
  },

  triggers: {
    quest: async (
      questTemplateId: number,
      token: string
    ): Promise<
      QuestCompleteResponse & { user_stats: { level: number; xp: number; gold: number } }
    > =>
      requestJSON<QuestCompleteResponse & { user_stats: { level: number; xp: number; gold: number } }>(
        `/triggers/quest/${questTemplateId}`,
        {
          method: "POST",
          headers: buildHeaders(token),
        },
        "Failed to trigger quest"
      ),
  },

  bounty: {
    getToday: async (token: string): Promise<DailyBounty> =>
      requestJSON<DailyBounty>(
        "/bounty/today",
        { headers: buildHeaders(token) },
        "Failed to fetch daily bounty"
      ),

    refresh: async (token: string): Promise<DailyBounty> =>
      requestJSON<DailyBounty>(
        "/bounty/refresh",
        {
          method: "POST",
          headers: buildHeaders(token),
        },
        "Failed to refresh daily bounty"
      ),

    checkTemplate: async (questId: number, token: string): Promise<BountyCheckResponse> =>
      requestJSON<BountyCheckResponse>(
        `/bounty/check/${questId}`,
        { headers: buildHeaders(token) },
        "Failed to check bounty status"
      ),
  },

  home: {
    getInviteCode: async (
      homeId: number,
      token: string
    ): Promise<{ invite_code: string; home_name: string }> =>
      requestJSON<{ invite_code: string; home_name: string }>(
        `/homes/${homeId}/invite-code`,
        { headers: buildHeaders(token) },
        "Failed to fetch invite code"
      ),
  },

  achievements: {
    getAll: async (token: string): Promise<Achievement[]> =>
      requestJSON<Achievement[]>(
        "/achievements",
        { headers: buildHeaders(token) },
        "Failed to fetch achievements"
      ),

    getMyAchievements: async (token: string): Promise<UserAchievement[]> =>
      requestJSON<UserAchievement[]>(
        "/achievements/me/achievements",
        { headers: buildHeaders(token) },
        "Failed to fetch user achievements"
      ),
  },

  rewards: {
    getAll: async (token: string): Promise<Reward[]> =>
      requestJSON<Reward[]>("/rewards", { headers: buildHeaders(token) }, "Failed to fetch rewards"),

    claim: async (rewardId: number, userId: number, token: string): Promise<UserRewardClaim> =>
      requestJSON<UserRewardClaim>(
        `/rewards/${rewardId}/claim?user_id=${userId}`,
        {
          method: "POST",
          headers: buildHeaders(token),
        },
        "Failed to claim reward"
      ),

    getUserClaims: async (userId: number, token: string): Promise<UserRewardClaim[]> =>
      requestJSON<UserRewardClaim[]>(
        `/rewards/user/${userId}/claims`,
        { headers: buildHeaders(token) },
        "Failed to fetch reward claims"
      ),
  },

  subscriptions: {
    getUpcoming: async (token: string): Promise<UpcomingSubscription[]> =>
      requestJSON<UpcomingSubscription[]>(
        "/subscriptions/upcoming",
        { headers: buildHeaders(token) },
        "Failed to fetch upcoming subscriptions"
      ),

    getAll: async (token: string): Promise<UserTemplateSubscription[]> =>
      requestJSON<UserTemplateSubscription[]>(
        "/subscriptions",
        { headers: buildHeaders(token) },
        "Failed to fetch subscriptions"
      ),

    create: async (
      subscriptionData: UserTemplateSubscriptionCreate,
      token: string
    ): Promise<UserTemplateSubscription> =>
      requestJSON<UserTemplateSubscription>(
        "/subscriptions",
        {
          method: "POST",
          headers: buildHeaders(token, true),
          body: JSON.stringify(subscriptionData),
        },
        "Failed to create subscription"
      ),

    update: async (
      subscriptionId: number,
      subscriptionData: UserTemplateSubscriptionUpdate,
      token: string
    ): Promise<UserTemplateSubscription> =>
      requestJSON<UserTemplateSubscription>(
        `/subscriptions/${subscriptionId}`,
        {
          method: "PATCH",
          headers: buildHeaders(token, true),
          body: JSON.stringify(subscriptionData),
        },
        "Failed to update subscription"
      ),

    delete: async (subscriptionId: number, token: string): Promise<void> =>
      requestVoid(
        `/subscriptions/${subscriptionId}`,
        { method: "DELETE", headers: buildHeaders(token) },
        "Failed to delete subscription"
      ),
  },
};
