export const SOUND_MUTE_STORAGE_KEY = "majordomo.sound.muted";

export interface AudioLike {
  currentTime: number;
  play: () => Promise<unknown> | unknown;
}

interface CreateSoundPlayerOptions<Effect extends string> {
  sounds: Record<Effect, string>;
  isMuted: () => boolean;
  createAudio?: (source: string) => AudioLike;
}

export const readStoredMutePreference = (
  storage: Pick<Storage, "getItem"> | null | undefined,
  storageKey: string = SOUND_MUTE_STORAGE_KEY
): boolean => {
  if (!storage) return false;

  try {
    return storage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
};

export const writeStoredMutePreference = (
  storage: Pick<Storage, "setItem"> | null | undefined,
  muted: boolean,
  storageKey: string = SOUND_MUTE_STORAGE_KEY
): void => {
  if (!storage) return;

  try {
    storage.setItem(storageKey, muted ? "true" : "false");
  } catch {
    // Ignore storage errors (private mode, quota, disabled storage)
  }
};

export const createSoundPlayer = <Effect extends string>({
  sounds,
  isMuted,
  createAudio,
}: CreateSoundPlayerOptions<Effect>) => {
  const audioFactory = createAudio ?? ((source: string) => new Audio(source));
  const audioCache = new Map<Effect, AudioLike>();

  const play = (effect: Effect): void => {
    if (isMuted()) return;

    let audio = audioCache.get(effect);
    if (!audio) {
      audio = audioFactory(sounds[effect]);
      audioCache.set(effect, audio);
    }

    try {
      audio.currentTime = 0;
    } catch {
      // Ignore when browser disallows currentTime updates.
    }

    try {
      const maybePromise = audio.play();
      if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === "function") {
        (maybePromise as Promise<unknown>).catch(() => undefined);
      }
    } catch {
      // Ignore playback failures caused by browser gesture restrictions.
    }
  };

  return { play };
};
