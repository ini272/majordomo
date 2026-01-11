import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { COLORS, PARCHMENT_STYLES } from "../constants/colors";
import StewardImage from "../assets/thesteward.png";
import ParchmentTypeWriter from "./ParchmentTypeWriter";

const AVAILABLE_TAGS = [
  "Chores",
  "Learning",
  "Exercise",
  "Health",
  "Organization",
];

export default function EditQuestModal({
  templateId,
  token,
  skipAI,
  onSave,
  onClose,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [template, setTemplate] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [time, setTime] = useState(2);
  const [effort, setEffort] = useState(2);
  const [dread, setDread] = useState(2);
  const [showTypeWriter, setShowTypeWriter] = useState(false);
  const [nameAnimationDone, setNameAnimationDone] = useState(false);

  // Fetch template and wait for Groq to populate it (unless skipAI is true)
  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        // Wait for Groq background task to complete (unless skipping AI)
        if (!skipAI) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        // Fetch the template
        const response = await api.quests.getTemplate(templateId, token);
        setTemplate(response);

        // Set form values from template
        setDisplayName(response.display_name || "");
        setDescription(response.description || "");

        // Parse tags
        if (response.tags) {
          const tags = response.tags.split(",").map((t) => {
            const trimmed = t.trim();
            // Capitalize first letter to match AVAILABLE_TAGS
            return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
          });
          setSelectedTags(tags);
        }

        setLoading(false);
        // Show typewriter animation after loading completes and has content
        if (response.display_name || response.description) {
          setShowTypeWriter(true);
        }
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [templateId, token, skipAI]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      // Calculate XP/Gold based on sliders
      const baseXP = (time + effort + dread) * 2;
      const baseGold = Math.floor(baseXP / 2);

      const updateData = {
        display_name: displayName.trim() || null,
        description: description.trim() || null,
        tags:
          selectedTags.length > 0 ? selectedTags.join(",").toLowerCase() : null,
        xp_reward: baseXP,
        gold_reward: baseGold,
      };

      const updated = await api.quests.updateTemplate(
        templateId,
        updateData,
        token,
      );
      onSave?.(updated);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [
    time,
    effort,
    dread,
    displayName,
    description,
    selectedTags,
    templateId,
    token,
    onSave,
    onClose,
  ]);

  const xp = (time + effort + dread) * 2;
  const gold = Math.floor(xp / 2);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-4xl p-6 md:p-8 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto flex gap-6"
        style={{
          backgroundColor: COLORS.darkPanel,
          borderColor: COLORS.gold,
          borderWidth: "2px",
        }}
      >
        {/* Form Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2
                className="text-2xl font-serif font-bold"
                style={{ color: COLORS.gold }}
              >
                Scribe Quest Details
              </h2>
              <button
                onClick={onClose}
                className="text-2xl leading-none"
                style={{ color: COLORS.gold }}
                disabled={loading || saving}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="px-3 py-2 mb-4 rounded-sm text-sm font-serif"
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

          {/* Loading State */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin mb-4">
                <div
                  className="w-12 h-12 border-4 rounded-full"
                  style={{
                    borderColor: COLORS.gold,
                    borderTopColor: "transparent",
                  }}
                />
              </div>
              <p
                className="text-center font-serif"
                style={{ color: COLORS.brown }}
              >
                The Scribe is weaving your quest...
              </p>
            </div>
          ) : (
            <>
              {/* Display Name */}
              <div className="mb-6">
                <label
                  className="block text-sm uppercase tracking-wider mb-2 font-serif"
                  style={{ color: COLORS.gold }}
                >
                  Quest Name (Fantasy)
                </label>
                {showTypeWriter ? (
                  <div
                    onClick={() => setShowTypeWriter(false)}
                    title="Click to skip animation"
                    className="cursor-pointer"
                  >
                    <ParchmentTypeWriter
                      text={displayName}
                      speed={30}
                      delay={200}
                      onComplete={() => setNameAnimationDone(true)}
                    />
                  </div>
                ) : (
                  <div
                    className="w-full rounded"
                    style={{
                      backgroundColor: PARCHMENT_STYLES.backgroundColor,
                      backgroundImage: PARCHMENT_STYLES.backgroundImage,
                      border: `2px solid ${PARCHMENT_STYLES.borderColor}`,
                      boxShadow: PARCHMENT_STYLES.boxShadow,
                    }}
                  >
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., The Cookery Cleanup"
                      className="w-full px-3 py-2 font-serif focus:outline-none transition-all"
                      style={{
                        backgroundColor: "transparent",
                        border: "none",
                        color: PARCHMENT_STYLES.textColor,
                        fontFamily: "Georgia, serif",
                      }}
                      disabled={saving}
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <label
                  className="block text-sm uppercase tracking-wider mb-2 font-serif"
                  style={{ color: COLORS.gold }}
                >
                  Description
                </label>
                {showTypeWriter && nameAnimationDone ? (
                  <div
                    onClick={() => setShowTypeWriter(false)}
                    title="Click to skip animation"
                    className="cursor-pointer"
                  >
                    <ParchmentTypeWriter
                      text={description}
                      speed={40}
                      delay={200}
                      onComplete={() => setShowTypeWriter(false)}
                    />
                  </div>
                ) : showTypeWriter ? (
                  <div
                    className="p-6 rounded"
                    style={{
                      backgroundColor: PARCHMENT_STYLES.backgroundColor,
                      backgroundImage: PARCHMENT_STYLES.backgroundImage,
                      border: `2px solid ${PARCHMENT_STYLES.borderColor}`,
                      minHeight: "100px",
                      boxShadow: PARCHMENT_STYLES.boxShadow,
                    }}
                  />
                ) : (
                  <div
                    className="w-full rounded"
                    style={{
                      backgroundColor: PARCHMENT_STYLES.backgroundColor,
                      backgroundImage: PARCHMENT_STYLES.backgroundImage,
                      border: `2px solid ${PARCHMENT_STYLES.borderColor}`,
                      boxShadow: PARCHMENT_STYLES.boxShadow,
                    }}
                  >
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g., Vanquish the grimy counters and slay the sink dragon."
                      rows="3"
                      className="w-full px-3 py-2 font-serif focus:outline-none transition-all"
                      style={{
                        backgroundColor: "transparent",
                        border: "none",
                        color: PARCHMENT_STYLES.textColor,
                        fontFamily: "Georgia, serif",
                        resize: "none",
                      }}
                      disabled={saving}
                    />
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="mb-6">
                <label
                  className="block text-sm uppercase tracking-wider mb-2 font-serif"
                  style={{ color: COLORS.gold }}
                >
                  Tags (Optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (selectedTags.includes(tag)) {
                          setSelectedTags(
                            selectedTags.filter((t) => t !== tag),
                          );
                        } else {
                          setSelectedTags([...selectedTags, tag]);
                        }
                      }}
                      className="px-3 py-1 text-xs uppercase tracking-wider font-serif rounded transition-all"
                      style={{
                        backgroundColor: selectedTags.includes(tag)
                          ? COLORS.gold
                          : `rgba(212, 175, 55, 0.2)`,
                        color: selectedTags.includes(tag)
                          ? COLORS.darkPanel
                          : COLORS.gold,
                        border: `1px solid ${COLORS.gold}`,
                        cursor: saving ? "not-allowed" : "pointer",
                      }}
                      disabled={saving}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div
                className="mb-6 p-4 rounded-lg"
                style={{
                  backgroundColor: `rgba(212, 175, 55, 0.1)`,
                  borderColor: COLORS.gold,
                  borderWidth: "1px",
                }}
              >
                <h3
                  className="text-sm uppercase tracking-wider mb-4 font-serif"
                  style={{ color: COLORS.gold }}
                >
                  Difficulty Assessment
                </h3>

                {/* Time Slider */}
                <div className="mb-4">
                  <label
                    className="block text-xs uppercase tracking-wider mb-2 font-serif"
                    style={{ color: COLORS.parchment }}
                  >
                    Time: {time}/5 (1=Quick, 5=Long)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={time}
                    onChange={(e) => setTime(parseInt(e.target.value))}
                    className="w-full"
                    disabled={saving}
                    style={{ accentColor: COLORS.gold }}
                  />
                </div>

                {/* Effort Slider */}
                <div className="mb-4">
                  <label
                    className="block text-xs uppercase tracking-wider mb-2 font-serif"
                    style={{ color: COLORS.parchment }}
                  >
                    Effort: {effort}/5 (1=Easy, 5=Hard)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={effort}
                    onChange={(e) => setEffort(parseInt(e.target.value))}
                    className="w-full"
                    disabled={saving}
                    style={{ accentColor: COLORS.gold }}
                  />
                </div>

                {/* Dread Slider */}
                <div className="mb-4">
                  <label
                    className="block text-xs uppercase tracking-wider mb-2 font-serif"
                    style={{ color: COLORS.parchment }}
                  >
                    Dread: {dread}/5 (1=Love it, 5=Hate it)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={dread}
                    onChange={(e) => setDread(parseInt(e.target.value))}
                    className="w-full"
                    disabled={saving}
                    style={{ accentColor: COLORS.gold }}
                  />
                </div>
              </div>

              {/* Rewards Preview */}
              <div
                className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-lg"
                style={{ backgroundColor: `rgba(212, 175, 55, 0.1)` }}
              >
                <div className="text-center">
                  <div
                    className="text-xs uppercase tracking-wider mb-1 font-serif"
                    style={{ color: COLORS.brown }}
                  >
                    XP Reward
                  </div>
                  <div
                    className="text-2xl font-serif font-bold"
                    style={{ color: COLORS.gold }}
                  >
                    {xp}
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className="text-xs uppercase tracking-wider mb-1 font-serif"
                    style={{ color: COLORS.brown }}
                  >
                    Gold Reward
                  </div>
                  <div
                    className="text-2xl font-serif font-bold"
                    style={{ color: COLORS.gold }}
                  >
                    {gold}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 py-3 font-serif font-semibold text-sm uppercase tracking-wider transition-all"
                  style={{
                    backgroundColor: `rgba(212, 175, 55, 0.1)`,
                    borderColor: COLORS.gold,
                    borderWidth: "2px",
                    color: COLORS.gold,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 font-serif font-semibold text-sm uppercase tracking-wider transition-all"
                  style={{
                    backgroundColor: saving
                      ? `rgba(212, 175, 55, 0.1)`
                      : `rgba(212, 175, 55, 0.2)`,
                    borderColor: COLORS.gold,
                    borderWidth: "2px",
                    color: COLORS.gold,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  {saving ? "Saving..." : "Save Quest"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Steward Image - Right side (hidden on mobile/tablet) */}
        <div className="hidden lg:flex flex-shrink-0 items-center justify-center w-48">
          <img
            src={StewardImage}
            alt="The Steward"
            className="w-full h-auto object-contain"
            style={{ maxHeight: "600px" }}
          />
        </div>
      </div>
    </div>
  );
}
