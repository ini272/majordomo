import { describe, expect, test } from "bun:test";

import {
  createSoundPlayer,
  readStoredMutePreference,
  writeStoredMutePreference,
} from "../src/utils/soundPlayer";

describe("mute preference storage", () => {
  test("reads stored mute flag", () => {
    const storage = {
      getItem: (key: string) => (key === "test-key" ? "true" : null),
    };

    expect(readStoredMutePreference(storage, "test-key")).toBe(true);
    expect(readStoredMutePreference(storage, "missing-key")).toBe(false);
  });

  test("writes mute flag as string boolean", () => {
    let storedValue: string | null = null;
    const storage = {
      setItem: (_key: string, value: string) => {
        storedValue = value;
      },
    };

    writeStoredMutePreference(storage, true, "test-key");
    expect(storedValue).toBe("true");

    writeStoredMutePreference(storage, false, "test-key");
    expect(storedValue).toBe("false");
  });
});

describe("createSoundPlayer", () => {
  test("does not play audio while muted", () => {
    let playCount = 0;
    const player = createSoundPlayer({
      sounds: { questActivate: "/quest.ogg" },
      isMuted: () => true,
      createAudio: () => ({
        currentTime: 5,
        play: () => {
          playCount += 1;
        },
      }),
    });

    player.play("questActivate");
    expect(playCount).toBe(0);
  });

  test("reuses cached audio instance and rewinds before replay", () => {
    let createCount = 0;
    let playCount = 0;

    const audio = {
      currentTime: 12,
      play: () => {
        playCount += 1;
        return Promise.resolve();
      },
    };

    const player = createSoundPlayer({
      sounds: { questComplete: "/complete.ogg" },
      isMuted: () => false,
      createAudio: () => {
        createCount += 1;
        return audio;
      },
    });

    player.play("questComplete");
    expect(createCount).toBe(1);
    expect(playCount).toBe(1);
    expect(audio.currentTime).toBe(0);

    audio.currentTime = 9;
    player.play("questComplete");
    expect(createCount).toBe(1);
    expect(playCount).toBe(2);
    expect(audio.currentTime).toBe(0);
  });
});
