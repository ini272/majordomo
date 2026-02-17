import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PlaygroundQuestCard, type PlaygroundQuest } from "../src/pages/QuestCardPlayground";

const baseQuest: PlaygroundQuest = {
  id: 101,
  title: "Base Quest",
  displayName: "Base Quest",
  description: "A simple quest description",
  questType: "standard",
  xpReward: 10,
  goldReward: 5,
  dueDate: null,
  tags: ["Test"],
  completed: false,
};

describe("PlaygroundQuestCard corruption overlay", () => {
  test("renders pulse overlay only for corrupted quests", () => {
    const corruptedMarkup = renderToStaticMarkup(
      <PlaygroundQuestCard
        quest={{ ...baseQuest, id: 102, questType: "corrupted" }}
        fontClassName="font-serif"
      />
    );
    const standardMarkup = renderToStaticMarkup(
      <PlaygroundQuestCard quest={baseQuest} fontClassName="font-serif" />
    );

    expect(corruptedMarkup).toContain('data-corruption-overlay="true"');
    expect(corruptedMarkup).toContain('data-corruption-overlay-glow="true"');
    expect(standardMarkup).not.toContain('data-corruption-overlay="true"');
    expect(standardMarkup).not.toContain('data-corruption-overlay-glow="true"');
  });

  test("does not render a full-frame aura layer", () => {
    const corruptedMarkup = renderToStaticMarkup(
      <PlaygroundQuestCard
        quest={{ ...baseQuest, id: 103, questType: "corrupted" }}
        fontClassName="font-serif"
      />
    );

    expect(corruptedMarkup).not.toContain('data-corruption-aura="true"');
  });
});
