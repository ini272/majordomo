import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import levelUpSound from "../sounds/LevelUp.ogg";
import questActivateSound from "../sounds/iQuestActivate.ogg";
import questCompleteSound from "../sounds/iQuestComplete.ogg";
import {
  createSoundPlayer,
  readStoredMutePreference,
  writeStoredMutePreference,
} from "../utils/soundPlayer";

const SOUND_EFFECTS = {
  questActivate: questActivateSound,
  questComplete: questCompleteSound,
  levelUp: levelUpSound,
} as const;

export type SoundEffect = keyof typeof SOUND_EFFECTS;

interface SoundContextValue {
  isMuted: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  playSound: (effect: SoundEffect) => void;
}

const SoundContext = createContext<SoundContextValue | undefined>(undefined);

const getInitialMutedState = (): boolean => {
  if (typeof window === "undefined") return false;
  return readStoredMutePreference(window.localStorage);
};

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMuted] = useState<boolean>(getInitialMutedState);
  const mutedRef = useRef(isMuted);

  const soundPlayerRef = useRef(
    createSoundPlayer({
      sounds: SOUND_EFFECTS,
      isMuted: () => mutedRef.current,
    })
  );

  useEffect(() => {
    mutedRef.current = isMuted;

    if (typeof window !== "undefined") {
      writeStoredMutePreference(window.localStorage, isMuted);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    setIsMuted(muted);
  }, []);

  const playSound = useCallback((effect: SoundEffect) => {
    soundPlayerRef.current.play(effect);
  }, []);

  const value = useMemo<SoundContextValue>(
    () => ({
      isMuted,
      toggleMute,
      setMuted,
      playSound,
    }),
    [isMuted, toggleMute, setMuted, playSound]
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundContextValue {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error("useSound must be used within a SoundProvider");
  }
  return context;
}
