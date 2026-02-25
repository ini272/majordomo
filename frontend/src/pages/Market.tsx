import { useState, useEffect, useCallback } from "react";
import { COLORS } from "../constants/colors";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import type { Reward, User } from "../types/api";

interface ConsumableCardProps {
  reward: Reward;
  user: User;
  onPurchase: (rewardId: number) => void;
  isPurchasing: boolean;
}

function ConsumableCard({ reward, user, onPurchase, isPurchasing }: ConsumableCardProps) {
  // Determine if this consumable is currently active
  const isElixir = reward.name === "Heroic Elixir";
  const isShield = reward.name === "Purification Shield";

  const isActive = isElixir
    ? user.active_xp_boost_count > 0
    : isShield && user.active_shield_expiry
      ? new Date(user.active_shield_expiry) > new Date()
      : false;

  const canAfford = user.gold_balance >= reward.cost;
  const canPurchase = canAfford && !isActive && !isPurchasing;

  // Get consumable-specific styling
  const getConsumableStyles = () => {
    if (isElixir) {
      return {
        borderColor: "#6b5fb7",
        titleColor: "#9d84ff",
        badgeBg: "rgba(107, 95, 183, 0.3)",
        badgeColor: "#9d84ff",
        icon: "⚗️",
        type: "XP Boost",
      };
    } else if (isShield) {
      return {
        borderColor: "#4a7c9b",
        titleColor: "#5fb7d4",
        badgeBg: "rgba(74, 124, 155, 0.3)",
        badgeColor: "#5fb7d4",
        icon: "🛡️",
        type: "Protection",
      };
    }
    return {
      borderColor: COLORS.gold,
      titleColor: COLORS.gold,
      badgeBg: "rgba(212, 175, 55, 0.1)",
      badgeColor: COLORS.gold,
      icon: "✨",
      type: "Consumable",
    };
  };

  const styles = getConsumableStyles();

  // Calculate time remaining for shield
  const getTimeRemaining = () => {
    if (!isShield || !user.active_shield_expiry) return null;
    const expiry = new Date(user.active_shield_expiry);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (diff < 0) return null;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  return (
    <div
      className="relative p-6 md:p-8 shadow-lg flex flex-col"
      style={{
        backgroundColor: COLORS.darkPanel,
        borderColor: styles.borderColor,
        borderWidth: "3px",
        borderStyle: "solid",
        minHeight: "280px",
      }}
    >
      {/* Decorative icon */}
      <div className="absolute top-4 right-4 text-4xl opacity-20">{styles.icon}</div>

      {/* Type Badge */}
      <div className="absolute top-4 left-4">
        <span
          className={`px-2 py-1 rounded text-xs uppercase font-serif font-bold ${isActive ? "animate-pulse" : ""}`}
          style={{
            backgroundColor: styles.badgeBg,
            color: styles.badgeColor,
          }}
        >
          {styles.type}
        </span>
      </div>

      {/* Consumable icon and name */}
      <div className="mt-8 mb-4 text-center">
        <div className="text-5xl mb-3">{styles.icon}</div>
        <h3
          className="text-xl md:text-2xl font-serif font-bold"
          style={{ color: styles.titleColor }}
        >
          {reward.name}
        </h3>
      </div>

      {/* Description */}
      <p
        className="font-serif text-sm md:text-base mb-6 flex-grow"
        style={{ color: COLORS.parchment }}
      >
        {reward.description}
      </p>

      {/* Active status or cost */}
      <div className="space-y-3">
        {isActive && (
          <div
            className="px-3 py-2 rounded text-center font-serif text-sm font-bold"
            style={{
              backgroundColor: styles.badgeBg,
              color: styles.badgeColor,
            }}
          >
            {isElixir
              ? `Active (${user.active_xp_boost_count} quests remaining)`
              : `Active (${getTimeRemaining()})`}
          </div>
        )}

        {/* Cost and purchase button */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="font-serif font-bold text-lg" style={{ color: COLORS.gold }}>
              {reward.cost}
            </span>
          </div>

          <button
            onClick={() => onPurchase(reward.id)}
            disabled={!canPurchase}
            className="px-4 py-2 font-serif font-bold text-sm md:text-base transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: canPurchase ? styles.badgeBg : "rgba(50, 50, 50, 0.3)",
              color: canPurchase ? styles.badgeColor : COLORS.brown,
              borderColor: canPurchase ? styles.borderColor : COLORS.brown,
              borderWidth: "2px",
              borderStyle: "solid",
            }}
          >
            {isPurchasing
              ? "Purchasing..."
              : isActive
                ? "Active"
                : !canAfford
                  ? "Insufficient Gold"
                  : "Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Market() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { token, userId } = useAuth();

  const loadData = useCallback(async () => {
    if (!token) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [rewardsData, userData] = await Promise.all([
        api.rewards.getAll(token),
        api.user.getStats(token),
      ]);

      // Filter to only show consumables (Heroic Elixir and Purification Shield)
      const consumables = rewardsData.filter(
        (r) => r.name === "Heroic Elixir" || r.name === "Purification Shield"
      );

      setRewards(consumables);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePurchase = async (rewardId: number) => {
    if (!token || userId === null) return;

    try {
      setPurchasingId(rewardId);
      setError(null);
      setSuccessMessage(null);

      await api.rewards.claim(rewardId, userId, token);

      // Show success message
      const reward = rewards.find((r) => r.id === rewardId);
      setSuccessMessage(`Successfully purchased ${reward?.name}!`);

      // Reload data to update user stats and consumable status
      await loadData();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to purchase consumable";
      setError(errorMessage);
    } finally {
      setPurchasingId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="font-serif text-lg" style={{ color: COLORS.parchment }}>
          Loading market...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1
          className="text-3xl md:text-4xl font-serif font-bold mb-2"
          style={{ color: COLORS.gold }}
        >
          The Market
        </h1>
        <p className="font-serif text-sm md:text-base" style={{ color: COLORS.parchment }}>
          Purchase consumables with your hard-earned gold
        </p>
        {user && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="font-serif font-bold text-xl" style={{ color: COLORS.gold }}>
              {user.gold_balance} Gold
            </span>
          </div>
        )}
      </div>

      {/* Success message */}
      {successMessage && (
        <div
          className="mb-6 p-4 rounded text-center font-serif font-bold"
          style={{
            backgroundColor: "rgba(95, 183, 84, 0.2)",
            color: COLORS.greenSuccess,
            borderColor: COLORS.greenSuccess,
            borderWidth: "2px",
            borderStyle: "solid",
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="mb-6 p-4 rounded text-center font-serif"
          style={{
            backgroundColor: "rgba(139, 0, 0, 0.2)",
            color: COLORS.redLight,
            borderColor: COLORS.redBorder,
            borderWidth: "2px",
            borderStyle: "solid",
          }}
        >
          {error}
        </div>
      )}

      {/* Consumables grid */}
      {rewards.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-serif text-lg" style={{ color: COLORS.parchment }}>
            No consumables available yet. Check back later!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {rewards.map((reward) => (
            <ConsumableCard
              key={reward.id}
              reward={reward}
              user={user!}
              onPurchase={handlePurchase}
              isPurchasing={purchasingId === reward.id}
            />
          ))}
        </div>
      )}

      {/* Info section */}
      <div
        className="mt-12 p-6 rounded"
        style={{
          backgroundColor: COLORS.darkPanel,
          borderColor: COLORS.brown,
          borderWidth: "2px",
          borderStyle: "solid",
        }}
      >
        <h3 className="font-serif font-bold text-lg mb-3" style={{ color: COLORS.gold }}>
          About Consumables
        </h3>
        <ul className="font-serif text-sm space-y-2" style={{ color: COLORS.parchment }}>
          <li>• Consumables are single-use items that provide temporary benefits</li>
          <li>• Only one of each type can be active at a time</li>
          <li>• Earn gold by completing quests to purchase more consumables</li>
          <li>• Choose wisely when to use your consumables for maximum benefit!</li>
        </ul>
      </div>
    </div>
  );
}
