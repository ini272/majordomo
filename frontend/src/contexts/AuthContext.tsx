import { createContext, useContext, useMemo, useState } from "react";
import { session } from "../services/session";

interface LoginPayload {
  token: string;
  userId: number;
  homeId: number;
  username?: string | null;
}

interface AuthContextValue {
  token: string | null;
  userId: number | null;
  homeId: number | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => void;
  setUsername: (username: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(session.getToken());
  const [userId, setUserId] = useState<number | null>(session.getUserId());
  const [homeId, setHomeId] = useState<number | null>(session.getHomeId());
  const [username, setUsernameState] = useState<string | null>(session.getUsername());

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      userId,
      homeId,
      username,
      isAuthenticated: !!token,
      login: ({ token: nextToken, userId: nextUserId, homeId: nextHomeId, username: nextUsername }) => {
        session.setLogin(nextToken, nextUserId, nextHomeId);
        setToken(nextToken);
        setUserId(nextUserId);
        setHomeId(nextHomeId);

        if (nextUsername) {
          session.setUsername(nextUsername);
          setUsernameState(nextUsername);
        }
      },
      setUsername: (nextUsername: string) => {
        session.setUsername(nextUsername);
        setUsernameState(nextUsername);
      },
      logout: () => {
        setToken(null);
        setUserId(null);
        setHomeId(null);
        setUsernameState(null);
        session.clear();
      },
    }),
    [token, userId, homeId, username]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
