import { Link, useLocation } from "react-router-dom";
import { COLORS } from "../constants/colors";

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

export default function BottomNav() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems: NavItem[] = [
    { path: "/board", label: "Board", icon: "📜" },
    { path: "/profile", label: "Profile", icon: "👤" },
    { path: "/market", label: "Market", icon: "💰" },
    { path: "/heroes", label: "Heroes", icon: "🏆" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex justify-around items-center py-3 md:py-4 border-t"
      style={{
        backgroundColor: COLORS.dark,
        borderTopColor: COLORS.gold,
        borderTopWidth: "2px",
      }}
    >
      {navItems.map(item => (
        <Link
          key={item.path}
          to={item.path}
          className="flex flex-col items-center gap-1 py-2 px-3 md:px-4 transition-all"
          style={{
            color: isActive(item.path) ? COLORS.gold : COLORS.brown,
            textDecoration: "none",
            borderBottomColor: isActive(item.path) ? COLORS.gold : "transparent",
            borderBottomWidth: isActive(item.path) ? "2px" : "0px",
          }}
        >
          <span className="text-xl md:text-2xl">{item.icon}</span>
          <span className="text-xs uppercase tracking-widest font-serif">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
