import { useState, useEffect } from "react";
import { COLORS } from "../constants/colors";
import { debugFontLoading, debugElementFont, getFontDebugInfo } from "../utils/fontDebug";

// Import fonts locally (only for playground)
import "../styles/playground-fonts.css";

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
  quest: (typeof sampleQuests)[0];
  fontClassName: string;
}

function PlaygroundQuestCard({ quest, fontClassName }: QuestCardProps) {
  return (
    <div
      className={`relative mb-8 ${fontClassName}`}
      style={{
        backgroundImage: "url(/src/assets/leonardo_4_3.png)",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        aspectRatio: "4/3",
        maxWidth: "700px",
        margin: "0 auto 2rem auto",
      }}
    >
      {/* Content container - positioned within parchment area */}
      <div
        className="relative h-full flex flex-col justify-between"
        style={{
          padding: "23% 24%", // Padding to position content in parchment center
        }}
      >
        {/* Title */}
        <h3
          className="text-2xl font-bold mb-4"
          style={{
            color: "#000000",
            textShadow: "0 1px 2px rgba(0,0,0,0.1)"
          }}
        >
          {quest.displayName}
        </h3>

        {/* Description */}
        <p
          className="text-base font-medium mb-6 flex-grow"
          style={{
            color: "#000000",
            lineHeight: "1.7"
          }}
        >
          {quest.description}
        </p>

        {/* Rewards - bottom section */}
        <div className="grid grid-cols-2 gap-6 mt-auto">
          <div>
            <div className="text-xs uppercase tracking-wider mb-1 font-semibold" style={{ color: "#000000" }}>
              XP Reward
            </div>
            <div className="text-xl font-bold" style={{ color: "#000000" }}>
              {quest.xpReward}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider mb-1 font-semibold" style={{ color: "#000000" }}>
              Gold Reward
            </div>
            <div className="text-xl font-bold" style={{ color: "#000000" }}>
              {quest.goldReward}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuestCardPlayground() {
  const [selectedFont, setSelectedFont] = useState(MEDIEVAL_FONTS[0]);
  const [fontDebugInfo, setFontDebugInfo] = useState<ReturnType<typeof getFontDebugInfo> | null>(
    null
  );

  useEffect(() => {
    console.log("🎨 QuestCardPlayground mounted - checking font loading...");

    // Enable font loading debugging
    debugFontLoading();

    // Check fonts after a short delay (let them load)
    const timer = setTimeout(() => {
      // Debug specific elements
      debugElementFont(".font-cinzel");
      debugElementFont(".font-fell");

      // Update debug info state
      setFontDebugInfo(getFontDebugInfo());
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: COLORS.dark }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1
            className={`text-4xl font-bold mb-2 ${selectedFont.className}`}
            style={{ color: COLORS.gold }}
          >
            Quest Card Design Playground
          </h1>
          <p className="text-sm" style={{ color: COLORS.brown }}>
            Testing Leonardo frame integration with minimal content
          </p>
        </div>

        {/* Font Selector */}
        <div
          className="mb-8 p-6 rounded-lg"
          style={{
            backgroundColor: COLORS.darkPanel,
            borderColor: COLORS.gold,
            borderWidth: "2px",
          }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: COLORS.gold }}>
            Select Font
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MEDIEVAL_FONTS.map(font => (
              <button
                key={font.name}
                onClick={() => setSelectedFont(font)}
                className={`p-4 rounded border-2 text-left transition-all ${font.className}`}
                style={{
                  backgroundColor:
                    selectedFont.name === font.name ? `${COLORS.gold}20` : "transparent",
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

        {/* Font Debug Info Panel */}
        {fontDebugInfo && (
          <div
            className="mb-8 p-6 rounded-lg"
            style={{
              backgroundColor: COLORS.darkPanel,
              borderColor: "#4ade80",
              borderWidth: "2px",
            }}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: "#4ade80" }}>
              Font Loading Status (Check Console for Details)
            </h2>
            <div className="space-y-2 text-sm font-mono" style={{ color: COLORS.parchment }}>
              <div>
                <strong>All Fonts Loaded:</strong>{" "}
                {fontDebugInfo.fontsLoaded ? "✅ Yes" : "⏳ Loading..."}
              </div>
              <div>
                <strong>Fonts Available:</strong> {fontDebugInfo.availableFonts.length}
              </div>
              {fontDebugInfo.availableFonts.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer" style={{ color: COLORS.gold }}>
                    Show loaded fonts ({fontDebugInfo.availableFonts.length})
                  </summary>
                  <ul className="mt-2 ml-4 space-y-1">
                    {fontDebugInfo.availableFonts.map((font, idx) => (
                      <li
                        key={idx}
                        style={{ color: font.status === "loaded" ? "#4ade80" : "#fbbf24" }}
                      >
                        {font.family} - {font.weight} {font.style} - {font.status}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Font Test - Debug Section */}
        <div
          className="mb-8 p-6 rounded-lg"
          style={{
            backgroundColor: COLORS.darkPanel,
            borderColor: COLORS.gold,
            borderWidth: "2px",
          }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: COLORS.gold }}>
            Font Loading Test
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs mb-1" style={{ color: COLORS.brown }}>
                Cinzel (should be decorative serif):
              </p>
              <p className="font-cinzel text-2xl" style={{ color: COLORS.parchment }}>
                The Quick Brown Fox Jumps Over The Lazy Dog
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: COLORS.brown }}>
                IM Fell English (should be old-style serif):
              </p>
              <p className="font-fell text-2xl" style={{ color: COLORS.parchment }}>
                The Quick Brown Fox Jumps Over The Lazy Dog
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: COLORS.brown }}>
                Georgia fallback (should be standard serif):
              </p>
              <p className="font-serif text-2xl" style={{ color: COLORS.parchment }}>
                The Quick Brown Fox Jumps Over The Lazy Dog
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: COLORS.brown }}>
                Comic Sans test (you should NOT see this font unless custom fonts fail):
              </p>
              <p
                style={{ fontFamily: "Comic Sans MS, cursive", color: COLORS.parchment }}
                className="text-2xl"
              >
                The Quick Brown Fox Jumps Over The Lazy Dog
              </p>
            </div>
          </div>
        </div>

        {/* Quest Cards Display */}
        <div className="mb-8">
          <h2
            className={`text-xl font-bold mb-4 ${selectedFont.className}`}
            style={{ color: COLORS.gold }}
          >
            Quest Card Examples
          </h2>
          <p className="text-sm mb-6" style={{ color: COLORS.brown }}>
            Minimal design with Leonardo frame - Title, Description, XP & Gold only
          </p>

          {sampleQuests.map(quest => (
            <PlaygroundQuestCard
              key={quest.id}
              quest={quest}
              fontClassName={selectedFont.className}
            />
          ))}
        </div>

        {/* Design Notes */}
        <div
          className="p-6 rounded-lg"
          style={{
            backgroundColor: COLORS.darkPanel,
            borderColor: COLORS.gold,
            borderWidth: "2px",
          }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: COLORS.gold }}>
            Design Features
          </h2>
          <ul className="space-y-2 text-sm" style={{ color: COLORS.parchment }}>
            <li>
              • <strong>Leonardo frame:</strong> AI-generated ornate medieval border (4:3 ratio)
            </li>
            <li>
              • <strong>Minimal content:</strong> Title, description, XP, and gold only
            </li>
            <li>
              • <strong>Authentic parchment:</strong> Real texture from the frame image
            </li>
            <li>
              • <strong>Centered layout:</strong> 15-18% padding to position content in parchment area
            </li>
            <li>
              • <strong>Readable text:</strong> Dark brown colors for good contrast
            </li>
            <li>
              • <strong>Aspect ratio preserved:</strong> Cards maintain 4:3 proportions
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
