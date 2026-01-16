import { useState } from "react";
import { COLORS } from "../constants/colors";

// Sample quest data for testing
const sampleQuests = [
  {
    id: 1,
    title: "The Grease Wars",
    displayName: "Cleansing of the Kitchen Realm",
    description: "Vanquish the grease demons that plague the sacred cooking grounds",
    questType: "standard",
    xpReward: 50,
    goldReward: 25,
    dueDate: "2026-01-18T12:00:00",
    tags: ["Chores", "Cleaning"],
    completed: false,
  },
  {
    id: 2,
    title: "Daily Bounty",
    displayName: "The Wanderer's Path",
    description: "Embark upon a journey of a thousand steps to strengthen thy resolve",
    questType: "bounty",
    xpReward: 100,
    goldReward: 50,
    dueDate: null,
    tags: ["Exercise", "Health"],
    completed: false,
  },
  {
    id: 3,
    title: "Corrupted Quest",
    displayName: "Overdue Laundry Mountain",
    description: "The textile mountains have grown too high! They must be conquered!",
    questType: "corrupted",
    xpReward: 75,
    goldReward: 38,
    dueDate: "2026-01-14T12:00:00",
    tags: ["Chores"],
    completed: false,
  },
  {
    id: 4,
    title: "Completed Quest",
    displayName: "Victory in the Kitchen",
    description: "The dishes have been slain, peace returns to the realm",
    questType: "standard",
    xpReward: 30,
    goldReward: 15,
    dueDate: null,
    tags: ["Chores"],
    completed: true,
  },
];

const MEDIEVAL_FONTS = [
  { name: "IM Fell English", className: "font-fell" },
  { name: "Cinzel", className: "font-cinzel" },
  { name: "Default (Georgia)", className: "font-serif" },
];

interface QuestCardProps {
  quest: typeof sampleQuests[0];
  fontClassName: string;
}

function PlaygroundQuestCard({ quest, fontClassName }: QuestCardProps) {
  const getTypeColor = () => {
    switch (quest.questType) {
      case "bounty":
        return { border: "#9d84ff", text: "#b8a7ff", bg: "#1a0f3d" };
      case "corrupted":
        return { border: "#ff6b6b", text: "#ff8080", bg: "#3d0f0f" };
      default:
        return { border: COLORS.gold, text: COLORS.gold, bg: COLORS.darkPanel };
    }
  };

  const colors = getTypeColor();
  const isOverdue = quest.dueDate && new Date(quest.dueDate) < new Date();

  return (
    <div
      className={`relative p-6 mb-4 rounded-lg shadow-lg border-2 transition-all ${fontClassName}`}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        boxShadow: `0 0 20px ${colors.border}40, inset 0 0 30px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Decorative corner elements */}
      <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 opacity-60"
        style={{ borderColor: colors.border }}
      />
      <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 opacity-60"
        style={{ borderColor: colors.border }}
      />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 opacity-60"
        style={{ borderColor: colors.border }}
      />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 opacity-60"
        style={{ borderColor: colors.border }}
      />

      {/* Parchment texture overlay */}
      <div
        className="absolute inset-0 rounded-lg opacity-10 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4af37' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Quest Type Badge */}
      <div className="flex justify-between items-start mb-3">
        <span
          className="text-xs uppercase tracking-wider px-2 py-1 rounded border"
          style={{
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: `${colors.border}20`,
          }}
        >
          {quest.questType}
          {quest.questType === "bounty" && " • 2x Rewards"}
          {quest.questType === "corrupted" && " • 1.5x Rewards"}
        </span>
        {quest.completed && (
          <span
            className="text-xs px-2 py-1 rounded border"
            style={{
              color: COLORS.greenSuccess,
              borderColor: COLORS.greenSuccess,
              backgroundColor: `${COLORS.greenSuccess}20`,
            }}
          >
            ✓ COMPLETE
          </span>
        )}
      </div>

      {/* Title */}
      <h3
        className="text-xl font-bold mb-2"
        style={{ color: colors.text }}
      >
        {quest.displayName}
      </h3>

      {/* Description */}
      <p
        className="text-sm mb-4 opacity-90"
        style={{ color: COLORS.parchment }}
      >
        {quest.description}
      </p>

      {/* Tags */}
      {quest.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {quest.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-1 rounded"
              style={{
                color: COLORS.brown,
                borderColor: COLORS.brown,
                borderWidth: "1px",
                backgroundColor: `${COLORS.brown}10`,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Due Date */}
      {quest.dueDate && !quest.completed && (
        <div className="mb-4">
          <span
            className="text-xs px-2 py-1 rounded border"
            style={{
              color: isOverdue ? "#ff6b6b" : COLORS.brown,
              borderColor: isOverdue ? "#ff6b6b" : COLORS.brown,
              backgroundColor: isOverdue ? "#ff6b6b20" : `${COLORS.brown}10`,
            }}
          >
            {isOverdue ? "⚠ OVERDUE" : `📅 Due ${new Date(quest.dueDate).toLocaleDateString()}`}
          </span>
        </div>
      )}

      {/* Rewards */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: `${colors.border}40` }}>
        <div>
          <div className="text-xs opacity-70" style={{ color: COLORS.brown }}>
            XP Reward
          </div>
          <div className="text-lg font-bold" style={{ color: colors.text }}>
            {quest.xpReward}
          </div>
        </div>
        <div>
          <div className="text-xs opacity-70" style={{ color: COLORS.brown }}>
            Gold Reward
          </div>
          <div className="text-lg font-bold" style={{ color: COLORS.gold }}>
            {quest.goldReward}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuestCardPlayground() {
  const [selectedFont, setSelectedFont] = useState(MEDIEVAL_FONTS[0]);

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: COLORS.dark }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className={`text-4xl font-bold mb-2 ${selectedFont.className}`} style={{ color: COLORS.gold }}>
            Quest Card Design Playground
          </h1>
          <p className="text-sm" style={{ color: COLORS.brown }}>
            Experiment with medieval fonts and parchment styling
          </p>
        </div>

        {/* Font Selector */}
        <div className="mb-8 p-6 rounded-lg" style={{ backgroundColor: COLORS.darkPanel, borderColor: COLORS.gold, borderWidth: "2px" }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: COLORS.gold }}>
            Select Font
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MEDIEVAL_FONTS.map((font) => (
              <button
                key={font.name}
                onClick={() => setSelectedFont(font)}
                className={`p-4 rounded border-2 text-left transition-all ${font.className}`}
                style={{
                  backgroundColor: selectedFont.name === font.name ? `${COLORS.gold}20` : "transparent",
                  borderColor: selectedFont.name === font.name ? COLORS.gold : COLORS.brown,
                  color: COLORS.parchment,
                }}
              >
                <div className="font-bold mb-1">{font.name}</div>
                <div className="text-sm opacity-70">The quick brown fox jumps</div>
              </button>
            ))}
          </div>
        </div>

        {/* Quest Cards Display */}
        <div className="mb-8">
          <h2 className={`text-xl font-bold mb-4 ${selectedFont.className}`} style={{ color: COLORS.gold }}>
            Quest Card Examples
          </h2>
          <p className="text-sm mb-6" style={{ color: COLORS.brown }}>
            Showing different quest states: Standard, Bounty, Corrupted, and Completed
          </p>

          {sampleQuests.map((quest) => (
            <PlaygroundQuestCard key={quest.id} quest={quest} fontClassName={selectedFont.className} />
          ))}
        </div>

        {/* Design Notes */}
        <div className="p-6 rounded-lg" style={{ backgroundColor: COLORS.darkPanel, borderColor: COLORS.gold, borderWidth: "2px" }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: COLORS.gold }}>
            Design Features
          </h2>
          <ul className="space-y-2 text-sm" style={{ color: COLORS.parchment }}>
            <li>• <strong>Hybrid approach:</strong> CSS borders + decorative corner elements</li>
            <li>• <strong>Parchment texture:</strong> Subtle SVG pattern overlay</li>
            <li>• <strong>Glowing borders:</strong> Box shadow matching quest type color</li>
            <li>• <strong>Type-based styling:</strong> Gold (standard), Purple (bounty), Red (corrupted)</li>
            <li>• <strong>Status indicators:</strong> Quest type badge, completion status, due dates</li>
            <li>• <strong>Responsive:</strong> Mobile-first vertical layout</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
