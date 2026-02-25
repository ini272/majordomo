const SESSION_KEYS = {
  token: "token",
  username: "username",
  userId: "userId",
  homeId: "homeId",
} as const;

const getNumberValue = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const session = {
  getToken: (): string | null => localStorage.getItem(SESSION_KEYS.token),
  getUsername: (): string | null => localStorage.getItem(SESSION_KEYS.username),
  getUserId: (): number | null => getNumberValue(localStorage.getItem(SESSION_KEYS.userId)),
  getHomeId: (): number | null => getNumberValue(localStorage.getItem(SESSION_KEYS.homeId)),

  setLogin: (token: string, userId: number, homeId: number) => {
    localStorage.setItem(SESSION_KEYS.token, token);
    localStorage.setItem(SESSION_KEYS.userId, userId.toString());
    localStorage.setItem(SESSION_KEYS.homeId, homeId.toString());
  },

  setUsername: (username: string) => {
    localStorage.setItem(SESSION_KEYS.username, username);
  },

  clear: () => {
    Object.values(SESSION_KEYS).forEach((key) => localStorage.removeItem(key));
  },
};
