import { Link, useLocation } from "react-router-dom";
import { COLORS } from "../constants/colors";

type NavIconName = "board" | "profile" | "market";

interface NavItem {
  path: string;
  label: string;
  icon: NavIconName;
}

function NavIcon({ name }: { name: NavIconName }) {
  const commonProps = {
    className: "h-7 w-7 md:h-8 md:w-8",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.65,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  switch (name) {
    case "board":
      return (
        <svg {...commonProps}>
          <path d="M7.2 3.6h8.2l2 2v14.8H6.6V4.2c0-.3.3-.6.6-.6Z" />
          <path d="M15.4 3.6v3.9h3.9" />
          <path d="M9.3 9.3h5.4" />
          <path d="M9.3 12.7h5.4" />
          <path d="M9.3 16.1h3.8" />
          <path d="M4.7 6.5v14.1h11.2" />
        </svg>
      );
    case "profile":
      return (
        <svg {...commonProps}>
          <path d="M12 12.2a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8Z" />
          <path d="M4.4 20.6c.8-4 3.7-6.4 7.6-6.4s6.8 2.4 7.6 6.4" />
        </svg>
      );
    case "market":
      return (
        <svg {...commonProps}>
          <path d="M8.2 9.1h7.6l2.2 10.8H6Z" />
          <path d="M9.2 9.1V7.4a2.8 2.8 0 0 1 5.6 0v1.7" />
          <path d="M12 12.4v4.7" />
          <path d="M10.4 13.7c.4-.7 1.2-1.1 2-1 .9.1 1.5.6 1.5 1.3 0 1.9-3.4.9-3.4 2.8 0 .8.8 1.3 1.7 1.3.8 0 1.5-.4 1.9-1" />
          <path d="M9.6 3.5 12 2.4l2.4 1.1" />
        </svg>
      );
  }
}

export default function BottomNav() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems: NavItem[] = [
    { path: "/board", label: "Board", icon: "board" },
    { path: "/profile", label: "Profile", icon: "profile" },
    { path: "/market", label: "Market", icon: "market" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-stretch justify-around border-t px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:px-8 md:pt-4"
      style={{
        background: "linear-gradient(180deg, #1c1b18 0%, #11100f 46%, #0d0d0d 100%)",
        borderTopColor: COLORS.gold,
        borderTopWidth: "1px",
        boxShadow: "0 -10px 24px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 226, 145, 0.09)",
      }}
    >
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className="relative flex min-w-20 flex-1 flex-col items-center gap-1 px-2 py-1.5 transition-all md:max-w-44"
          style={{
            color: isActive(item.path) ? COLORS.gold : COLORS.brown,
            textDecoration: "none",
            filter: isActive(item.path) ? "drop-shadow(0 0 8px rgba(212, 175, 55, 0.28))" : "none",
          }}
          aria-current={isActive(item.path) ? "page" : undefined}
        >
          <NavIcon name={item.icon} />
          <span className="font-serif text-[0.7rem] uppercase tracking-[0.16em] md:text-xs">
            {item.label}
          </span>
          <span
            aria-hidden="true"
            className="absolute -bottom-1 h-px w-16 transition-opacity"
            style={{
              background: `linear-gradient(90deg, transparent, ${COLORS.gold}, transparent)`,
              opacity: isActive(item.path) ? 1 : 0,
            }}
          />
        </Link>
      ))}
    </nav>
  );
}
