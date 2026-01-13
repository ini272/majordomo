import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { COLORS } from "../constants/colors";

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

type AuthMode = "login" | "signup" | "join";

export default function Login({ onLoginSuccess }: LoginProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);

    try {
      let data;

      if (mode === "signup") {
        const email = form.get("email") as string;
        const username = form.get("username") as string;
        const password = form.get("password") as string;
        const homeName = form.get("homeName") as string;

        data = await api.auth.signup(email, username, password, homeName);
        setInviteCode(data.invite_code);
      } else if (mode === "join") {
        const inviteCode = form.get("inviteCode") as string;
        const email = form.get("email") as string;
        const username = form.get("username") as string;
        const password = form.get("password") as string;

        data = await api.auth.join(inviteCode, email, username, password);
      } else {
        // Login mode
        const email = form.get("email") as string;
        const password = form.get("password") as string;

        data = await api.auth.loginEmail(email, password);
      }

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("userId", data.user_id.toString());
      localStorage.setItem("homeId", data.home_id.toString());

      // Fetch user stats to get username
      try {
        const userStats = await api.user.getStats(data.access_token);
        localStorage.setItem("username", userStats.username);
      } catch (err) {
        console.error("Failed to fetch user stats:", err);
      }

      onLoginSuccess(data.access_token);

      // Check for next redirect param
      const params = new URLSearchParams(window.location.search);
      const nextUrl = params.get("next");

      if (nextUrl) {
        navigate(nextUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `${mode} failed`);
    } finally {
      setLoading(false);
    }
  };

  const getModeTitle = () => {
    switch (mode) {
      case "signup":
        return "Create New Home";
      case "join":
        return "Join Existing Home";
      default:
        return "Enter Quest Log";
    }
  };

  const getModeButton = () => {
    switch (mode) {
      case "signup":
        return loading ? "Creating..." : "Create Home";
      case "join":
        return loading ? "Joining..." : "Join Home";
      default:
        return loading ? "Logging in..." : "Enter";
    }
  };

  return (
    <div className="p-8 md:p-10 max-w-md mx-auto">
      {/* Mode Selector */}
      <div className="flex mb-6 gap-2">
        <button
          onClick={() => setMode("login")}
          className="flex-1 py-2 px-4 font-serif text-sm uppercase tracking-wider transition-all"
          style={{
            backgroundColor: mode === "login" ? COLORS.gold : "transparent",
            borderColor: COLORS.gold,
            borderWidth: "2px",
            color: mode === "login" ? COLORS.black : COLORS.gold,
          }}
        >
          Login
        </button>
        <button
          onClick={() => setMode("signup")}
          className="flex-1 py-2 px-4 font-serif text-sm uppercase tracking-wider transition-all"
          style={{
            backgroundColor: mode === "signup" ? COLORS.gold : "transparent",
            borderColor: COLORS.gold,
            borderWidth: "2px",
            color: mode === "signup" ? COLORS.black : COLORS.gold,
          }}
        >
          Sign Up
        </button>
        <button
          onClick={() => setMode("join")}
          className="flex-1 py-2 px-4 font-serif text-sm uppercase tracking-wider transition-all"
          style={{
            backgroundColor: mode === "join" ? COLORS.gold : "transparent",
            borderColor: COLORS.gold,
            borderWidth: "2px",
            color: mode === "join" ? COLORS.black : COLORS.gold,
          }}
        >
          Join
        </button>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="p-8 md:p-10 shadow-lg"
        style={{
          backgroundColor: COLORS.darkPanel,
          borderColor: COLORS.gold,
          borderWidth: "4px",
        }}
      >
        <h2
          className="text-2xl font-serif font-bold mb-6 text-center uppercase tracking-wider"
          style={{ color: COLORS.gold }}
        >
          {getModeTitle()}
        </h2>

        {/* Error */}
        {error && (
          <div
            className="px-4 py-3 mb-6 rounded-sm font-serif text-sm"
            style={{
              backgroundColor: COLORS.redDarker,
              borderColor: COLORS.redBorder,
              borderWidth: "1px",
              color: COLORS.redLight,
            }}
          >
            {error}
          </div>
        )}

        {/* Success message for signup with invite code */}
        {inviteCode && mode === "signup" && (
          <div
            className="px-4 py-3 mb-6 rounded-sm font-serif text-sm"
            style={{
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              borderColor: "rgb(34, 197, 94)",
              borderWidth: "1px",
              color: "rgb(134, 239, 172)",
            }}
          >
            <p className="font-bold mb-2">Home created successfully!</p>
            <p className="mb-1">Share this invite code with others:</p>
            <p className="font-mono text-base" style={{ color: COLORS.gold }}>
              {inviteCode}
            </p>
          </div>
        )}

        {/* Signup Fields */}
        {mode === "signup" && (
          <>
            <div className="mb-6 md:mb-8">
              <label
                className="block text-sm uppercase tracking-wider mb-2 font-serif"
                style={{ color: COLORS.gold }}
              >
                Email Address
              </label>
              <input
                type="email"
                name="email"
                placeholder="adventurer@realm.com"
                required
                className="w-full px-3 py-2 md:py-3 font-serif placeholder-opacity-50 focus:outline-none focus:shadow-lg transition-all"
                style={{
                  backgroundColor: COLORS.black,
                  borderColor: COLORS.gold,
                  borderWidth: "2px",
                  color: COLORS.parchment,
                }}
              />
            </div>

            <div className="mb-6 md:mb-8">
              <label
                className="block text-sm uppercase tracking-wider mb-2 font-serif"
                style={{ color: COLORS.gold }}
              >
                Username
              </label>
              <input
                type="text"
                name="username"
                placeholder="DragonSlayer"
                required
                className="w-full px-3 py-2 md:py-3 font-serif placeholder-opacity-50 focus:outline-none focus:shadow-lg transition-all"
                style={{
                  backgroundColor: COLORS.black,
                  borderColor: COLORS.gold,
                  borderWidth: "2px",
                  color: COLORS.parchment,
                }}
              />
            </div>

            <div className="mb-6 md:mb-8">
              <label
                className="block text-sm uppercase tracking-wider mb-2 font-serif"
                style={{ color: COLORS.gold }}
              >
                Home Name
              </label>
              <input
                type="text"
                name="homeName"
                placeholder="The Dragon's Den"
                required
                className="w-full px-3 py-2 md:py-3 font-serif placeholder-opacity-50 focus:outline-none focus:shadow-lg transition-all"
                style={{
                  backgroundColor: COLORS.black,
                  borderColor: COLORS.gold,
                  borderWidth: "2px",
                  color: COLORS.parchment,
                }}
              />
            </div>

            <div className="mb-8 md:mb-10">
              <label
                className="block text-sm uppercase tracking-wider mb-2 font-serif"
                style={{ color: COLORS.gold }}
              >
                Password
              </label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 md:py-3 font-serif placeholder-opacity-50 focus:outline-none focus:shadow-lg transition-all"
                style={{
                  backgroundColor: COLORS.black,
                  borderColor: COLORS.gold,
                  borderWidth: "2px",
                  color: COLORS.parchment,
                }}
              />
            </div>
          </>
        )}

        {/* Join Fields */}
        {mode === "join" && (
          <>
            <div className="mb-6 md:mb-8">
              <label
                className="block text-sm uppercase tracking-wider mb-2 font-serif"
                style={{ color: COLORS.gold }}
              >
                Invite Code
              </label>
              <input
                type="text"
                name="inviteCode"
                placeholder="abc123xyz"
                required
                className="w-full px-3 py-2 md:py-3 font-mono placeholder-opacity-50 focus:outline-none focus:shadow-lg transition-all"
                style={{
                  backgroundColor: COLORS.black,
                  borderColor: COLORS.gold,
                  borderWidth: "2px",
                  color: COLORS.parchment,
                }}
              />
            </div>

            <div className="mb-6 md:mb-8">
              <label
                className="block text-sm uppercase tracking-wider mb-2 font-serif"
                style={{ color: COLORS.gold }}
              >
                Email Address
              </label>
              <input
                type="email"
                name="email"
                placeholder="adventurer@realm.com"
                required
                className="w-full px-3 py-2 md:py-3 font-serif placeholder-opacity-50 focus:outline-none focus:shadow-lg transition-all"
                style={{
                  backgroundColor: COLORS.black,
                  borderColor: COLORS.gold,
                  borderWidth: "2px",
                  color: COLORS.parchment,
                }}
              />
            </div>

            <div className="mb-6 md:mb-8">
              <label
                className="block text-sm uppercase tracking-wider mb-2 font-serif"
                style={{ color: COLORS.gold }}
              >
                Username
              </label>
              <input
                type="text"
                name="username"
                placeholder="DragonSlayer"
                required
                className="w-full px-3 py-2 md:py-3 font-serif placeholder-opacity-50 focus:outline-none focus:shadow-lg transition-all"
                style={{
                  backgroundColor: COLORS.black,
                  borderColor: COLORS.gold,
                  borderWidth: "2px",
                  color: COLORS.parchment,
                }}
              />
            </div>

            <div className="mb-8 md:mb-10">
              <label
                className="block text-sm uppercase tracking-wider mb-2 font-serif"
                style={{ color: COLORS.gold }}
              >
                Password
              </label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 md:py-3 font-serif placeholder-opacity-50 focus:outline-none focus:shadow-lg transition-all"
                style={{
                  backgroundColor: COLORS.black,
                  borderColor: COLORS.gold,
                  borderWidth: "2px",
                  color: COLORS.parchment,
                }}
              />
            </div>
          </>
        )}

        {/* Login Fields */}
        {mode === "login" && (
          <>
            <div className="mb-6 md:mb-8">
              <label
                className="block text-sm uppercase tracking-wider mb-2 font-serif"
                style={{ color: COLORS.gold }}
              >
                Email Address
              </label>
              <input
                type="email"
                name="email"
                placeholder="adventurer@realm.com"
                required
                className="w-full px-3 py-2 md:py-3 font-serif placeholder-opacity-50 focus:outline-none focus:shadow-lg transition-all"
                style={{
                  backgroundColor: COLORS.black,
                  borderColor: COLORS.gold,
                  borderWidth: "2px",
                  color: COLORS.parchment,
                }}
              />
            </div>

            <div className="mb-8 md:mb-10">
              <label
                className="block text-sm uppercase tracking-wider mb-2 font-serif"
                style={{ color: COLORS.gold }}
              >
                Password
              </label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 md:py-3 font-serif placeholder-opacity-50 focus:outline-none focus:shadow-lg transition-all"
                style={{
                  backgroundColor: COLORS.black,
                  borderColor: COLORS.gold,
                  borderWidth: "2px",
                  color: COLORS.parchment,
                }}
              />
            </div>
          </>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 md:py-4 font-serif font-semibold text-sm uppercase tracking-wider transition-all duration-300 hover:shadow-lg"
          style={{
            backgroundColor: loading ? `rgba(212, 175, 55, 0.1)` : `rgba(212, 175, 55, 0.2)`,
            borderColor: COLORS.gold,
            borderWidth: "2px",
            color: COLORS.gold,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {getModeButton()}
        </button>
      </form>
    </div>
  );
}
