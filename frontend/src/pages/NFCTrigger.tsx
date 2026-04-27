import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, isRequestError } from "../services/api";
import { COLORS } from "../constants/colors";
import { useAuth } from "../contexts/AuthContext";
import type { TriggerQuestResponse } from "../types/api";

const SHARED_QUEST_ERROR_FRAGMENT = "shared quest";

export default function NFCTrigger() {
  const { nfcCode } = useParams<{ nfcCode: string }>();
  const navigate = useNavigate();
  const requestKeyRef = useRef<string | null>(null);
  const [result, setResult] = useState<TriggerQuestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { token, logout } = useAuth();

  useEffect(() => {
    const nextUrl = `/t/${nfcCode ?? ""}`;

    if (!token) {
      navigate(`/?next=${encodeURIComponent(nextUrl)}`);
      return;
    }

    const requestKey = `${token}:${nfcCode ?? ""}`;
    if (requestKeyRef.current === requestKey) return;
    requestKeyRef.current = requestKey;

    const triggerQuest = async () => {
      try {
        if (!nfcCode) {
          throw new Error("Invalid quest trigger");
        }

        const data = await api.triggers.nfc(nfcCode, token);
        setResult(data);
        setError(null);
        setLoading(false);
      } catch (err) {
        if (isRequestError(err) && err.status === 401) {
          logout();
          navigate(`/?next=${encodeURIComponent(nextUrl)}`);
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to trigger quest");
        setLoading(false);
      }
    };

    triggerQuest();
  }, [nfcCode, token, navigate, logout]);

  // Still loading
  if (loading && !result && !error) {
    return (
      <div className="text-center py-12 md:py-16">
        <p className="font-serif text-lg" style={{ color: COLORS.brown }}>
          Processing NFC trigger...
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    const isSharedQuestError = error.toLowerCase().includes(SHARED_QUEST_ERROR_FRAGMENT);
    const errorTitle = isSharedQuestError ? "Shared Quest Found" : "Scan Failed";
    const errorMessage = isSharedQuestError
      ? "This tag matched a quest that is assigned to more than one player."
      : error;
    const errorGuidance = isSharedQuestError
      ? "NFC only completes personal quests. Open the board to complete this shared quest there."
      : null;

    return (
      <div className="text-center py-12 md:py-16">
        <h2
          className="text-2xl md:text-3xl font-serif font-bold mb-4"
          style={{ color: COLORS.redLight }}
        >
          ⚠ {errorTitle}
        </h2>
        <p className="font-serif mb-6" style={{ color: COLORS.parchment }}>
          {errorMessage}
        </p>
        {errorGuidance && (
          <p className="font-serif mb-6" style={{ color: COLORS.brown }}>
            {errorGuidance}
          </p>
        )}
        <button
          onClick={() => navigate("/board")}
          className="px-6 py-2 font-serif text-sm uppercase tracking-wider transition-all"
          style={{
            backgroundColor: COLORS.redDark,
            borderColor: COLORS.gold,
            borderWidth: "1px",
            color: COLORS.gold,
          }}
        >
          Return to Board
        </button>
      </div>
    );
  }

  // Success state
  if (result) {
    return (
      <div className="text-center py-12 md:py-16">
        <div className="animate-bounce mb-6">
          <p className="text-5xl md:text-6xl">⚔</p>
        </div>
        <h2
          className="text-2xl md:text-4xl font-serif font-bold mb-2"
          style={{ color: result.duplicate ? COLORS.gold : COLORS.greenSuccess }}
        >
          {result.duplicate ? "Already Counted" : "Quest Complete!"}
        </h2>
        <p className="text-lg md:text-2xl font-serif mb-8" style={{ color: COLORS.gold }}>
          {result.quest.display_name || result.quest.title}
        </p>

        {result.duplicate && (
          <p className="font-serif mb-8" style={{ color: COLORS.parchment }}>
            Scan ignored for {result.cooldown_remaining_seconds ?? result.cooldown_seconds} more
            seconds.
          </p>
        )}

        {/* Rewards Display */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-12 justify-center mb-8 py-6 md:py-8">
          <div className="text-center">
            <p
              className="text-xs uppercase tracking-widest mb-2 font-serif"
              style={{ color: COLORS.brown }}
            >
              XP Gained
            </p>
            <p
              className="text-3xl md:text-4xl font-serif font-bold"
              style={{ color: COLORS.greenSuccess }}
            >
              +{result.rewards.xp}
            </p>
          </div>
          <div className="text-center">
            <p
              className="text-xs uppercase tracking-widest mb-2 font-serif"
              style={{ color: COLORS.brown }}
            >
              Gold Gained
            </p>
            <p className="text-3xl md:text-4xl font-serif font-bold" style={{ color: COLORS.gold }}>
              +{result.rewards.gold}
            </p>
          </div>
        </div>

        {/* Updated Stats */}
        <div className="text-sm md:text-base font-serif mb-6" style={{ color: COLORS.parchment }}>
          <p>
            Level {result.user_stats.level} • {result.user_stats.xp} XP • {result.user_stats.gold}{" "}
            Gold
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-xs md:text-sm font-serif italic" style={{ color: COLORS.brown }}>
            Review the result, then head back when you are ready.
          </p>
          <button
            type="button"
            onClick={() => navigate("/board")}
            className="px-6 py-2 font-serif text-sm uppercase tracking-wider transition-all"
            style={{
              backgroundColor: "rgba(212, 175, 55, 0.14)",
              borderColor: COLORS.gold,
              borderWidth: "1px",
              color: COLORS.gold,
            }}
          >
            Return to Board
          </button>
        </div>
      </div>
    );
  }

  return null;
}
