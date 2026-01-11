import { motion } from "framer-motion";
import TypeWriter from "./TypeWriter";
import { PARCHMENT_STYLES } from "../constants/colors";

interface ParchmentTypeWriterProps {
  text: string;
  speed?: number;
  delay?: number;
  onComplete?: () => void;
}

export default function ParchmentTypeWriter({
  text,
  speed = 50,
  delay = 0,
  onComplete,
}: ParchmentTypeWriterProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative w-full p-6 rounded"
      style={{
        backgroundColor: PARCHMENT_STYLES.backgroundColor,
        backgroundImage: PARCHMENT_STYLES.backgroundImage,
        border: `2px solid ${PARCHMENT_STYLES.borderColor}`,
        boxShadow: PARCHMENT_STYLES.boxShadow,
        minHeight: "100px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Burnt edge overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: PARCHMENT_STYLES.burnt,
          pointerEvents: "none",
        }}
      />

      {/* Text content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          fontFamily: "Georgia, serif",
          color: PARCHMENT_STYLES.textColor,
          fontSize: "16px",
          lineHeight: "1.6",
          letterSpacing: "0.5px",
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
        }}
      >
        <TypeWriter text={text} speed={speed} delay={delay} onComplete={onComplete} hideCursor />
        {/* Quill cursor - only shown while typing */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: [1, 0.5] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          style={{
            marginLeft: "4px",
            fontSize: "20px",
            display: "inline-block",
          }}
        >
          🖋️
        </motion.span>
      </div>
    </motion.div>
  );
}
