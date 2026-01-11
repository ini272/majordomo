import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { COLORS } from "../constants/colors";
import type { QuestCompleteResponse } from "../types/api";

interface NFCTriggerResult extends QuestCompleteResponse {
  user_stats: {
    level: number;
    xp: number;
    gold: number;
  };
}

export default function NFCTrigger() {
  const { questTemplateId } = useParams<{ questTemplateId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<NFCTriggerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      // Not logged in, redirect to login with next param
      const nextUrl = `/trigger/quest/${questTemplateId}`;
      navigate(`/?next=${encodeURIComponent(nextUrl)}`);
      return;
    }

    // Logged in, trigger the quest
    const triggerQuest = async () => {
      try {
        const templateId = parseInt(questTemplateId || "0");
        const data = await api.triggers.quest(templateId, token);
        setResult(data);
        setError(null);
        // Auto-return to board after 3 seconds
        setTimeout(() => navigate("/board"), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to trigger quest");
        setLoading(false);
      }
    };

    triggerQuest();
  }, [questTemplateId, token, navigate]);

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
    return (
      <div className="text-center py-12 md:py-16">
        <h2
          className="text-2xl md:text-3xl font-serif font-bold mb-4"
          style={{ color: COLORS.redLight }}
        >
          ⚠ Error
        </h2>
        <p className="font-serif mb-6" style={{ color: COLORS.parchment }}>
          {error}
        </p>
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
          style={{ color: COLORS.greenSuccess }}
        >
          Quest Complete!
        </h2>
        <p className="text-lg md:text-2xl font-serif mb-8" style={{ color: COLORS.gold }}>
          {result.quest.template.display_name || result.quest.template.title}
        </p>

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

        <p className="text-xs md:text-sm font-serif italic" style={{ color: COLORS.brown }}>
          Returning to board...
        </p>
      </div>
    );
  }

  return null;
}
