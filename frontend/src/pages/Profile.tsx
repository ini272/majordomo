import { COLORS } from "../constants/colors";

export default function Profile() {
  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-serif font-bold mb-4" style={{ color: COLORS.gold }}>
        Character Sheet
      </h2>
      <p className="font-serif" style={{ color: COLORS.parchment }}>
        Coming soon...
      </p>
    </div>
  );
}
