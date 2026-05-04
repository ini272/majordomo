import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { LAYERS } from "../constants/layers";
import ModalShell from "../components/modal/ModalShell";
import { useAuth } from "../contexts/AuthContext";
import { useSound } from "../contexts/SoundContext";
import { api } from "../services/api";
import type { Home, User } from "../types/api";
import { copyTextToClipboard } from "../utils/clipboard";
import { formatTimeZoneLabel } from "../utils/dateTime";
import {
  readStoredSkipAiQuestCreationPreference,
  writeStoredSkipAiQuestCreationPreference,
} from "../utils/preferences";

type IconName =
  | "palette"
  | "moon"
  | "sun"
  | "shield"
  | "users"
  | "castle"
  | "user"
  | "mail"
  | "volume"
  | "wand"
  | "clock"
  | "logout"
  | "trash"
  | "chevron"
  | "crest";

type EditField = "houseName" | "username" | "email";

interface IconProps {
  name: IconName;
  className?: string;
}

interface SettingsSectionProps {
  title: string;
  icon: IconName;
  children: ReactNode;
}

interface SettingsRowProps {
  icon: IconName;
  title: string;
  description: string;
  value?: string;
  action?: ReactNode;
  danger?: boolean;
}

function SettingsIcon({ name, className = "h-7 w-7" }: IconProps) {
  const commonProps = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  switch (name) {
    case "palette":
      return (
        <svg {...commonProps}>
          <path d="M12.2 3.2a8.8 8.8 0 0 0-1.1 17.5h1.6a1.8 1.8 0 0 0 1.3-3.1 1.7 1.7 0 0 1 1.2-2.9h1.2a4.6 4.6 0 0 0 4.4-5.8 8.9 8.9 0 0 0-8.6-5.7Z" />
          <path d="M7.5 10.2h.1" />
          <path d="M9.6 6.8h.1" />
          <path d="M14.2 6.9h.1" />
          <path d="M16.8 10.3h.1" />
        </svg>
      );
    case "moon":
      return (
        <svg {...commonProps}>
          <path d="M20.2 14.4A7.8 7.8 0 0 1 9.6 3.8a8.6 8.6 0 1 0 10.6 10.6Z" />
          <path d="M16.8 3.8v2.6" />
          <path d="M15.5 5.1h2.6" />
        </svg>
      );
    case "sun":
      return (
        <svg {...commonProps}>
          <path d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z" />
          <path d="M12 2.8v2" />
          <path d="M12 19.2v2" />
          <path d="m4.5 4.5 1.4 1.4" />
          <path d="m18.1 18.1 1.4 1.4" />
          <path d="M2.8 12h2" />
          <path d="M19.2 12h2" />
          <path d="m4.5 19.5 1.4-1.4" />
          <path d="m18.1 5.9 1.4-1.4" />
        </svg>
      );
    case "shield":
      return (
        <svg {...commonProps}>
          <path d="M12 3.2 5.1 5.8v5.5c0 4.4 2.8 7.7 6.9 9.5 4.1-1.8 6.9-5.1 6.9-9.5V5.8L12 3.2Z" />
          <path d="M12 7.2v8.9" />
          <path d="M8.8 10.4h6.4" />
        </svg>
      );
    case "users":
      return (
        <svg {...commonProps}>
          <path d="M8.2 11.2a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Z" />
          <path d="M15.8 11.2a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Z" />
          <path d="M3.5 20.2v-1.3c0-2.5 2.1-4.5 4.7-4.5s4.7 2 4.7 4.5v1.3" />
          <path d="M12.1 14.9a5.1 5.1 0 0 1 3.7-1.5c2.6 0 4.7 2 4.7 4.5v2.3" />
        </svg>
      );
    case "castle":
      return (
        <svg {...commonProps}>
          <path d="M4.2 20.2V8.5l2.2 1.3 2.2-1.3 2.2 1.3 2.2-1.3 2.2 1.3 2.2-1.3 2.4 1.3v10.4" />
          <path d="M7.2 8V4.2h3.1V8" />
          <path d="M13.7 8V4.2h3.1V8" />
          <path d="M9.3 20.2v-4.5a2.7 2.7 0 0 1 5.4 0v4.5" />
          <path d="M3.2 20.2h17.6" />
        </svg>
      );
    case "user":
      return (
        <svg {...commonProps}>
          <path d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z" />
          <path d="M4.5 20.4c.8-3.8 3.6-6.1 7.5-6.1s6.7 2.3 7.5 6.1" />
        </svg>
      );
    case "mail":
      return (
        <svg {...commonProps}>
          <path d="M4.2 6.5h15.6v11H4.2z" />
          <path d="m4.8 7.2 7.2 5.6 7.2-5.6" />
          <path d="m4.9 17 5.5-4.9" />
          <path d="m19.1 17-5.5-4.9" />
        </svg>
      );
    case "volume":
      return (
        <svg {...commonProps}>
          <path d="M4.2 9.3h3.6l5-4.1v13.6l-5-4.1H4.2Z" />
          <path d="M16 8.1a5.8 5.8 0 0 1 0 7.8" />
          <path d="M18.7 5.7a9.1 9.1 0 0 1 0 12.6" />
        </svg>
      );
    case "wand":
      return (
        <svg {...commonProps}>
          <path d="m5 19 9.5-9.5" />
          <path d="m12.6 7.6 3.8 3.8" />
          <path d="M17.9 3.9v3.2" />
          <path d="M16.3 5.5h3.2" />
          <path d="M6.4 4.8v2.4" />
          <path d="M5.2 6h2.4" />
          <path d="M19.1 16.2v2.8" />
          <path d="M17.7 17.6h2.8" />
        </svg>
      );
    case "clock":
      return (
        <svg {...commonProps}>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path d="M12 7.3v5.1l3.4 2.1" />
        </svg>
      );
    case "logout":
      return (
        <svg {...commonProps}>
          <path d="M9.8 4.7H5.1v14.6h4.7" />
          <path d="M13 8.2 16.8 12 13 15.8" />
          <path d="M16.6 12H8.8" />
          <path d="M18.9 5.2v13.6" />
        </svg>
      );
    case "trash":
      return (
        <svg {...commonProps}>
          <path d="M4.8 6.8h14.4" />
          <path d="M9.3 6.8V4.4h5.4v2.4" />
          <path d="M7 6.8 8 20h8l1-13.2" />
          <path d="M10.4 10.2v6.2" />
          <path d="M13.6 10.2v6.2" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...commonProps}>
          <path d="m9 5.5 6.5 6.5L9 18.5" />
        </svg>
      );
    case "crest":
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 44 52"
          aria-hidden="true"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M22 3.2 38.4 9v13.6c0 10.6-6.4 19.5-16.4 25.7C12 42.1 5.6 33.2 5.6 22.6V9Z"
            strokeWidth="1.6"
          />
          <path
            d="M22 7.8 34 12v10.7c0 8.4-4.6 15.1-12 20-7.4-4.9-12-11.6-12-20V12Z"
            strokeWidth="1"
          />
          <path
            d="M16.7 33.8c3.1-4.9 8.4-7.4 10.6-13.3 1.3-3.5-.2-7.1-3.1-9.1.4 4.3-2.9 6.1-5.1 8.6-3.5 4-3.8 8.7-2.4 13.8Z"
            strokeWidth="1.4"
          />
          <path d="M22.9 18.4c2.2 3.7.8 7.3-3.7 10.9" strokeWidth="1.1" />
        </svg>
      );
  }
}

function SectionDivider() {
  return (
    <div className="my-4 flex items-center gap-4" aria-hidden="true">
      <div
        className="h-px flex-1"
        style={{
          background: `linear-gradient(90deg, transparent, ${COLORS.goldDarker}, ${COLORS.gold})`,
        }}
      />
      <div className="h-2 w-2 rotate-45 border" style={{ borderColor: COLORS.goldDarker }} />
      <div
        className="h-px flex-1"
        style={{
          background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.goldDarker}, transparent)`,
        }}
      />
    </div>
  );
}

function SegmentedThemeControl() {
  const [selectedTheme, setSelectedTheme] = useState<"dark" | "light">("dark");
  const options: Array<{ value: "dark" | "light"; label: string; icon: IconName }> = [
    { value: "dark", label: "Dark", icon: "moon" },
    { value: "light", label: "Light", icon: "sun" },
  ];

  return (
    <div
      className="grid w-full max-w-[23rem] grid-cols-2 overflow-hidden rounded-[8px]"
      style={{
        border: `1px solid ${COLORS.gold}`,
        backgroundColor: "rgba(9, 8, 7, 0.72)",
      }}
    >
      {options.map((option) => {
        const isActive = selectedTheme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => setSelectedTheme(option.value)}
            className="flex min-h-12 items-center justify-center gap-2 px-3 font-serif text-base transition-colors sm:text-lg"
            style={{
              backgroundColor: isActive ? "rgba(212, 175, 55, 0.16)" : "transparent",
              color: isActive ? COLORS.gold : COLORS.parchment,
              borderRight: option.value === "dark" ? `1px solid ${COLORS.goldDarker}` : "0",
              boxShadow: isActive ? "inset 0 0 18px rgba(212, 175, 55, 0.09)" : "none",
            }}
          >
            <SettingsIcon name={option.icon} className="h-5 w-5" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="relative h-9 w-[5.25rem] shrink-0 rounded-full transition-colors"
      style={{
        backgroundColor: checked ? COLORS.gold : "rgba(12, 10, 8, 0.88)",
        border: `1px solid ${checked ? COLORS.gold : COLORS.brown}`,
        boxShadow: checked
          ? "inset 0 0 14px rgba(255, 230, 153, 0.23), 0 0 10px rgba(212, 175, 55, 0.14)"
          : "inset 0 0 12px rgba(0, 0, 0, 0.7)",
      }}
    >
      <span
        className="absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full transition-all"
        style={{
          left: checked ? "calc(100% - 2rem)" : "0.25rem",
          backgroundColor: COLORS.parchmentLight,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.55)",
        }}
      />
    </button>
  );
}

function SettingsSection({ title, icon, children }: SettingsSectionProps) {
  return (
    <section
      className="overflow-hidden rounded-[8px] px-4 py-4 shadow-2xl sm:px-5"
      style={{
        background:
          "linear-gradient(145deg, rgba(17, 16, 14, 0.95), rgba(7, 8, 8, 0.94)), radial-gradient(circle at 16% 20%, rgba(212, 175, 55, 0.08), transparent 34%)",
        border: `1px solid rgba(212, 175, 55, 0.42)`,
        boxShadow:
          "inset 0 0 0 1px rgba(0, 0, 0, 0.58), inset 0 18px 38px rgba(255, 255, 255, 0.015), 0 16px 34px rgba(0, 0, 0, 0.38)",
      }}
    >
      <header
        className="flex items-center gap-3 pb-4"
        style={{ borderBottom: `1px solid ${COLORS.brown}` }}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          style={{
            color: COLORS.gold,
            filter: "drop-shadow(0 0 8px rgba(212, 175, 55, 0.22))",
          }}
        >
          <SettingsIcon name={icon} />
        </span>
        <h2
          className="font-serif text-lg font-bold uppercase tracking-[0.08em] sm:text-xl"
          style={{ color: COLORS.gold }}
        >
          {title}
        </h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

function SettingsRow({
  icon,
  title,
  description,
  value,
  action,
  danger = false,
}: SettingsRowProps) {
  const titleColor = danger ? COLORS.redLight : COLORS.parchmentLight;
  const trailingColor = danger ? COLORS.redLight : COLORS.gold;

  return (
    <div
      className="grid min-h-[5.25rem] grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 gap-y-3 py-4 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center"
      style={{ borderBottom: `1px solid rgba(139, 115, 85, 0.38)` }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center self-start sm:h-11 sm:w-11 sm:self-center"
        style={{
          color: danger ? COLORS.redLight : COLORS.gold,
          opacity: danger ? 0.95 : 0.82,
          filter: danger
            ? "drop-shadow(0 0 7px rgba(255, 107, 107, 0.18))"
            : "drop-shadow(0 0 7px rgba(212, 175, 55, 0.16))",
        }}
      >
        <SettingsIcon name={icon} className="h-8 w-8" />
      </div>
      <div className="min-w-0">
        <h3 className="font-serif text-xl leading-tight sm:text-2xl" style={{ color: titleColor }}>
          {title}
        </h3>
        <p
          className="mt-1 font-serif text-base leading-snug sm:text-lg"
          style={{ color: COLORS.parchment }}
        >
          {description}
        </p>
      </div>
      <div className="col-span-2 flex min-w-0 items-center justify-end gap-3 pl-12 sm:col-span-1 sm:pl-6">
        {value && (
          <span
            className="min-w-0 text-right font-serif text-lg leading-tight sm:text-xl md:text-2xl"
            style={{ color: trailingColor }}
          >
            {value}
          </span>
        )}
        {action}
        {!action && <SettingsIcon name="chevron" className="h-6 w-6 shrink-0" />}
      </div>
    </div>
  );
}

function OutlineButton({
  children,
  danger = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 rounded-[6px] px-5 font-serif text-lg transition-colors sm:min-w-[8.5rem] sm:text-xl"
      style={{
        backgroundColor: "rgba(10, 9, 8, 0.58)",
        border: `1px solid ${danger ? COLORS.redLight : COLORS.gold}`,
        color: danger ? COLORS.redLight : COLORS.gold,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        boxShadow: danger
          ? "inset 0 0 16px rgba(255, 107, 107, 0.04)"
          : "inset 0 0 16px rgba(212, 175, 55, 0.05)",
      }}
    >
      {children}
    </button>
  );
}

function ValueActionButton({
  value,
  onClick,
  disabled = false,
  danger = false,
}: {
  value: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-w-0 items-center gap-3 text-right"
      style={{
        color: danger ? COLORS.redLight : COLORS.gold,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span className="min-w-0 font-serif text-lg leading-tight sm:text-xl md:text-2xl">
        {value}
      </span>
      <SettingsIcon name="chevron" className="h-6 w-6 shrink-0" />
    </button>
  );
}

function PassiveValue({ value }: { value: string }) {
  return (
    <span
      className="min-w-0 text-right font-serif text-lg leading-tight sm:text-xl md:text-2xl"
      style={{ color: COLORS.parchment }}
    >
      {value}
    </span>
  );
}

function SettingsTextInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  helpText,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email";
  placeholder?: string;
  helpText?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block font-serif text-sm uppercase tracking-[0.16em]"
        style={{ color: COLORS.brown }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-[6px] px-4 py-3 font-serif text-lg outline-none transition-colors"
        style={{
          backgroundColor: "rgba(4, 4, 4, 0.55)",
          border: `1px solid ${COLORS.goldDarker}`,
          color: COLORS.parchmentLight,
        }}
      />
      {helpText && (
        <p className="mt-2 font-serif text-sm" style={{ color: COLORS.parchment }}>
          {helpText}
        </p>
      )}
    </div>
  );
}

const getInitialSkipAiQuestCreationPreference = (): boolean => {
  if (typeof window === "undefined") return false;
  return readStoredSkipAiQuestCreationPreference(window.localStorage);
};

const DELETE_ACCOUNT_CONFIRMATION_TEXT = "DELETE";

const EDIT_FIELD_CONFIG: Record<
  EditField,
  {
    title: string;
    description: string;
    label: string;
    placeholder: string;
    saveLabel: string;
    type?: "text" | "email";
    helpText?: string;
  }
> = {
  houseName: {
    title: "Edit House Name",
    description: "Update the name shown for your household.",
    label: "House Name",
    placeholder: "Panketal Manor",
    saveLabel: "Save House Name",
  },
  username: {
    title: "Edit Username",
    description: "Choose how your hero name appears across the house.",
    label: "Username",
    placeholder: "Frechdachs",
    saveLabel: "Save Username",
  },
  email: {
    title: "Edit Email",
    description: "Use a valid email address for account recovery and login.",
    label: "Email",
    placeholder: "frechdachs@example.com",
    saveLabel: "Save Email",
    type: "email",
  },
};

export default function Settings() {
  const navigate = useNavigate();
  const { token, homeId, logout, setUsername } = useAuth();
  const { isMuted, setMuted } = useSound();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{ invite_code: string; home_name: string } | null>(
    null
  );
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [showInviteCodes, setShowInviteCodes] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [activeEditField, setActiveEditField] = useState<EditField | null>(null);
  const [editFieldValue, setEditFieldValue] = useState("");
  const [editFieldError, setEditFieldError] = useState<string | null>(null);
  const [savingEditField, setSavingEditField] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteAccountConfirmationValue, setDeleteAccountConfirmationValue] = useState("");
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [skipAiQuestCreation, setSkipAiQuestCreation] = useState(
    getInitialSkipAiQuestCreationPreference
  );

  useEffect(() => {
    const loadSettings = async () => {
      if (!token || homeId === null) {
        setLoadingSettings(false);
        return;
      }

      setLoadingSettings(true);
      setSettingsError(null);

      try {
        const [userData, homeData, inviteData] = await Promise.all([
          api.user.getStats(token),
          api.home.get(homeId, token),
          api.home.getInviteCode(homeId, token),
        ]);
        setCurrentUser(userData);
        setHome(homeData);
        setInviteInfo(inviteData);
      } catch (err) {
        setSettingsError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoadingSettings(false);
      }
    };

    loadSettings();
  }, [homeId, token]);

  const handleSkipAiQuestCreationChange = () => {
    setSkipAiQuestCreation((current) => {
      const nextValue = !current;
      if (typeof window !== "undefined") {
        writeStoredSkipAiQuestCreationPreference(window.localStorage, nextValue);
      }
      return nextValue;
    });
  };

  const handleCopyInviteCode = async () => {
    if (!inviteInfo) return;

    const copied = await copyTextToClipboard(inviteInfo.invite_code);
    if (!copied) return;

    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const openEditField = (field: EditField) => {
    setEditFieldError(null);
    setActiveEditField(field);

    if (field === "houseName") {
      setEditFieldValue(home?.name ?? "");
      return;
    }

    if (field === "username") {
      setEditFieldValue(currentUser?.username ?? "");
      return;
    }

    if (field === "email") {
      setEditFieldValue(currentUser?.email ?? "");
    }
  };

  const closeEditFieldModal = () => {
    setActiveEditField(null);
    setEditFieldValue("");
    setEditFieldError(null);
  };

  const handleSaveEditField = async () => {
    if (!activeEditField || !token) return;

    const trimmedValue = editFieldValue.trim();
    if (!trimmedValue) {
      setEditFieldError("This field is required.");
      return;
    }

    setSavingEditField(true);
    setEditFieldError(null);

    try {
      if (activeEditField === "houseName") {
        if (!home) throw new Error("Home details are not loaded");
        const updatedHome = await api.home.update(home.id, { name: trimmedValue }, token);
        setHome(updatedHome);
        setInviteInfo((current) =>
          current ? { ...current, home_name: updatedHome.name } : current
        );
      } else if (activeEditField === "username") {
        const updatedUser = await api.user.updateMe({ username: trimmedValue }, token);
        setCurrentUser(updatedUser);
        setUsername(updatedUser.username);
      } else if (activeEditField === "email") {
        const updatedUser = await api.user.updateMe({ email: trimmedValue }, token);
        setCurrentUser(updatedUser);
      }

      closeEditFieldModal();
    } catch (err) {
      setEditFieldError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSavingEditField(false);
    }
  };

  const closeDeleteAccountModal = () => {
    setShowDeleteAccountConfirm(false);
    setDeleteAccountConfirmationValue("");
    setDeleteAccountError(null);
  };

  const handleDeleteAccount = async () => {
    if (!token) return;

    if (deleteAccountConfirmationValue.trim().toUpperCase() !== DELETE_ACCOUNT_CONFIRMATION_TEXT) {
      setDeleteAccountError(`Type ${DELETE_ACCOUNT_CONFIRMATION_TEXT} to confirm.`);
      return;
    }

    setDeletingAccount(true);
    setDeleteAccountError(null);

    try {
      await api.user.deleteMe(token);
      logout();
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteAccountError(err instanceof Error ? err.message : "Failed to delete account");
      setDeletingAccount(false);
    }
  };

  const displayHomeName =
    home?.name ?? inviteInfo?.home_name ?? (loadingSettings ? "Loading..." : "Unknown House");
  const displayUsername =
    currentUser?.username ?? (loadingSettings ? "Loading..." : "Unknown Hero");
  const displayEmail = currentUser?.email ?? (loadingSettings ? "Loading..." : "No email set");
  const displayTimeZone = formatTimeZoneLabel(home?.timezone);
  const activeEditFieldConfig = activeEditField ? EDIT_FIELD_CONFIG[activeEditField] : null;

  return (
    <div
      className="relative mx-auto max-w-5xl overflow-hidden px-1 pb-4 pt-2 sm:px-3"
      style={{ color: COLORS.parchment }}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 18% 8%, rgba(212, 175, 55, 0.08), transparent 27%), radial-gradient(circle at 78% 2%, rgba(139, 115, 85, 0.06), transparent 31%), radial-gradient(circle at 50% 98%, rgba(212, 175, 55, 0.07), transparent 26%)",
        }}
      />

      <header className="relative mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div
              className="flex h-16 w-14 shrink-0 items-center justify-center sm:h-20 sm:w-[4.5rem]"
              style={{
                color: COLORS.gold,
                filter: "drop-shadow(0 0 14px rgba(212, 175, 55, 0.28))",
              }}
            >
              <SettingsIcon name="crest" className="h-full w-full" />
            </div>
            <div className="min-w-0 pt-1">
              <p
                className="font-serif text-3xl font-bold uppercase leading-none tracking-[0.06em] sm:text-4xl"
                style={{
                  color: COLORS.gold,
                  textShadow: "0 0 12px rgba(212, 175, 55, 0.22)",
                }}
              >
                Majordomo
              </p>
              <p
                className="mt-1 font-serif text-lg leading-snug sm:text-2xl"
                style={{ color: COLORS.parchment }}
              >
                Turn chores into quests.
              </p>
            </div>
          </div>
          <p
            className="shrink-0 pt-1 font-serif text-sm sm:text-base"
            style={{ color: COLORS.brown }}
          >
            v1.3.2
          </p>
        </div>

        <h1
          className="mt-6 font-serif text-5xl font-bold leading-none sm:text-6xl"
          style={{
            color: COLORS.gold,
            textShadow: "0 0 16px rgba(212, 175, 55, 0.2)",
          }}
        >
          Settings
        </h1>
        <SectionDivider />
      </header>

      {settingsError && (
        <div
          className="mb-6 rounded-[8px] px-4 py-3 text-center font-serif"
          style={{
            backgroundColor: "rgba(139, 0, 0, 0.2)",
            border: `1px solid ${COLORS.redBorder}`,
            color: COLORS.redLight,
          }}
        >
          {settingsError}
        </div>
      )}

      <main className="space-y-6">
        <SettingsSection title="Appearance" icon="palette">
          <div className="grid min-h-[5.25rem] grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 gap-y-3 py-4 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center">
            <div
              className="flex h-10 w-10 items-center justify-center self-start sm:h-11 sm:w-11 sm:self-center"
              style={{ color: COLORS.gold, opacity: 0.82 }}
            >
              <SettingsIcon name="mail" className="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <h3
                className="font-serif text-xl leading-tight sm:text-2xl"
                style={{ color: COLORS.parchmentLight }}
              >
                Theme
              </h3>
              <p
                className="mt-1 font-serif text-base leading-snug sm:text-lg"
                style={{ color: COLORS.parchment }}
              >
                Choose your preferred appearance.
              </p>
            </div>
            <div className="col-span-2 flex justify-end pl-12 sm:col-span-1 sm:min-w-[23rem] sm:pl-6">
              <SegmentedThemeControl />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="House & Account" icon="shield">
          <SettingsRow
            icon="users"
            title="Invite Codes"
            description="Invite others to join your house."
            action={
              <OutlineButton
                onClick={() => {
                  setShowInviteCodes(true);
                  setCopiedInvite(false);
                }}
                disabled={!inviteInfo}
              >
                <span className="inline-flex items-center gap-2">
                  View Codes
                  <SettingsIcon name="chevron" className="h-5 w-5" />
                </span>
              </OutlineButton>
            }
          />
          <SettingsRow
            icon="castle"
            title="House Name"
            description="Change your house name."
            action={
              <ValueActionButton
                value={displayHomeName}
                onClick={() => openEditField("houseName")}
                disabled={!home}
              />
            }
          />
          <SettingsRow
            icon="user"
            title="Username"
            description="Change your username."
            action={
              <ValueActionButton
                value={displayUsername}
                onClick={() => openEditField("username")}
                disabled={!currentUser}
              />
            }
          />
          <SettingsRow
            icon="mail"
            title="Email"
            description="Change your email address."
            action={
              <ValueActionButton
                value={displayEmail}
                onClick={() => openEditField("email")}
                disabled={!currentUser}
              />
            }
          />
        </SettingsSection>

        <SettingsSection title="Preferences" icon="palette">
          <SettingsRow
            icon="volume"
            title="Sound"
            description="Enable or disable all sounds."
            action={<ToggleSwitch checked={!isMuted} onChange={() => setMuted(!isMuted)} />}
          />
          <SettingsRow
            icon="wand"
            title="Always Skip AI Quest Creation"
            description="Skip AI suggestions and create quests manually."
            action={
              <ToggleSwitch
                checked={skipAiQuestCreation}
                onChange={handleSkipAiQuestCreationChange}
              />
            }
          />
          <SettingsRow
            icon="clock"
            title="Home Timezone"
            description="Inferred for quest schedules and local day boundaries."
            action={<PassiveValue value={displayTimeZone} />}
          />
        </SettingsSection>

        <SettingsSection title="Account" icon="user">
          <SettingsRow
            icon="logout"
            title="Logout"
            description="Sign out of your account on this device."
            action={<OutlineButton onClick={handleLogout}>Logout</OutlineButton>}
          />
          <SettingsRow
            icon="trash"
            title="Delete Account"
            description="Permanently delete your account and all data."
            danger
            action={
              <OutlineButton danger onClick={() => setShowDeleteAccountConfirm(true)}>
                Delete Account
              </OutlineButton>
            }
          />
        </SettingsSection>
      </main>

      <footer
        className="mt-6 flex items-center justify-center gap-3 px-4 text-center font-serif text-base sm:text-lg"
        style={{ color: COLORS.brown }}
      >
        <SettingsIcon name="shield" className="h-6 w-6 shrink-0" />
        <span>Your data is safe with us. We never share your information.</span>
      </footer>

      <ModalShell
        isOpen={showInviteCodes}
        onClose={() => setShowInviteCodes(false)}
        closeOnBackdrop={true}
        overlayClassName="p-4 bg-black/75 items-center"
        panelClassName="w-full max-w-md"
        zIndex={LAYERS.modal}
      >
        <div
          className="rounded-[8px] p-5"
          style={{
            background: "linear-gradient(145deg, rgba(17, 16, 14, 0.98), rgba(7, 8, 8, 0.98))",
            border: `1px solid rgba(212, 175, 55, 0.55)`,
            boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.6), 0 18px 36px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div className="mb-4 flex items-center gap-3">
            <span style={{ color: COLORS.gold }}>
              <SettingsIcon name="users" className="h-8 w-8" />
            </span>
            <div>
              <h2 className="font-serif text-2xl font-bold" style={{ color: COLORS.gold }}>
                Invite Codes
              </h2>
              <p className="font-serif text-sm" style={{ color: COLORS.parchment }}>
                {displayHomeName}
              </p>
            </div>
          </div>

          <div
            className="mb-5 rounded-[6px] px-4 py-4 text-center"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.32)",
              border: `1px solid ${COLORS.brown}`,
            }}
          >
            <p
              className="mb-2 font-serif text-xs uppercase tracking-[0.18em]"
              style={{ color: COLORS.brown }}
            >
              House Invite Code
            </p>
            <p className="break-all font-serif text-2xl font-bold" style={{ color: COLORS.gold }}>
              {inviteInfo?.invite_code ?? "Unavailable"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <OutlineButton onClick={handleCopyInviteCode} disabled={!inviteInfo}>
              {copiedInvite ? "Copied" : "Copy Code"}
            </OutlineButton>
            <OutlineButton onClick={() => setShowInviteCodes(false)}>Close</OutlineButton>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        isOpen={activeEditField !== null}
        onClose={closeEditFieldModal}
        closeOnBackdrop={true}
        overlayClassName="p-4 bg-black/75 items-center"
        panelClassName="w-full max-w-lg"
        zIndex={LAYERS.modal}
      >
        {activeEditFieldConfig && (
          <div
            className="rounded-[8px] p-5"
            style={{
              background: "linear-gradient(145deg, rgba(17, 16, 14, 0.98), rgba(7, 8, 8, 0.98))",
              border: `1px solid rgba(212, 175, 55, 0.55)`,
              boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.6), 0 18px 36px rgba(0, 0, 0, 0.5)",
            }}
          >
            <h2 className="font-serif text-2xl font-bold" style={{ color: COLORS.gold }}>
              {activeEditFieldConfig.title}
            </h2>
            <p className="mt-2 font-serif text-base" style={{ color: COLORS.parchment }}>
              {activeEditFieldConfig.description}
            </p>

            <div className="mt-5">
              <SettingsTextInput
                id={`settings-${activeEditField}-input`}
                label={activeEditFieldConfig.label}
                value={editFieldValue}
                onChange={setEditFieldValue}
                type={activeEditFieldConfig.type}
                placeholder={activeEditFieldConfig.placeholder}
                helpText={activeEditFieldConfig.helpText}
                disabled={savingEditField}
              />
            </div>

            {editFieldError && (
              <div
                className="mt-4 rounded-[6px] px-4 py-3 font-serif text-sm"
                style={{
                  backgroundColor: "rgba(139, 0, 0, 0.2)",
                  border: `1px solid ${COLORS.redBorder}`,
                  color: COLORS.redLight,
                }}
              >
                {editFieldError}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <OutlineButton onClick={handleSaveEditField} disabled={savingEditField}>
                {savingEditField ? "Saving..." : activeEditFieldConfig.saveLabel}
              </OutlineButton>
              <OutlineButton onClick={closeEditFieldModal} disabled={savingEditField}>
                Cancel
              </OutlineButton>
            </div>
          </div>
        )}
      </ModalShell>

      <ModalShell
        isOpen={showDeleteAccountConfirm}
        onClose={closeDeleteAccountModal}
        closeOnBackdrop={true}
        overlayClassName="p-4 bg-black/75 items-center"
        panelClassName="w-full max-w-lg"
        zIndex={LAYERS.modal}
      >
        <div
          className="rounded-[8px] p-5"
          style={{
            background: "linear-gradient(145deg, rgba(17, 16, 14, 0.98), rgba(7, 8, 8, 0.98))",
            border: `1px solid rgba(255, 107, 107, 0.55)`,
            boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.6), 0 18px 36px rgba(0, 0, 0, 0.5)",
          }}
        >
          <h2 className="font-serif text-2xl font-bold" style={{ color: COLORS.redLight }}>
            Delete Account
          </h2>
          <p className="mt-2 font-serif text-base" style={{ color: COLORS.parchment }}>
            This deletes your account immediately. If you are the last member of the house, the
            house and its related data will be removed too.
          </p>

          <div className="mt-5">
            <SettingsTextInput
              id="settings-delete-account-confirmation"
              label={`Type ${DELETE_ACCOUNT_CONFIRMATION_TEXT} to confirm`}
              value={deleteAccountConfirmationValue}
              onChange={setDeleteAccountConfirmationValue}
              placeholder={DELETE_ACCOUNT_CONFIRMATION_TEXT}
              disabled={deletingAccount}
            />
          </div>

          {deleteAccountError && (
            <div
              className="mt-4 rounded-[6px] px-4 py-3 font-serif text-sm"
              style={{
                backgroundColor: "rgba(139, 0, 0, 0.2)",
                border: `1px solid ${COLORS.redBorder}`,
                color: COLORS.redLight,
              }}
            >
              {deleteAccountError}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <OutlineButton danger onClick={handleDeleteAccount} disabled={deletingAccount}>
              {deletingAccount ? "Deleting..." : "Delete Account"}
            </OutlineButton>
            <OutlineButton onClick={closeDeleteAccountModal} disabled={deletingAccount}>
              Cancel
            </OutlineButton>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
