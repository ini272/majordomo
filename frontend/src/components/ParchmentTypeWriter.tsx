import { useEffect, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import TypeWriter from "./TypeWriter";
import { PARCHMENT_STYLES } from "../constants/colors";

interface ParchmentTypeWriterProps {
  text: string;
  speed?: number;
  delay?: number;
  onComplete?: () => void;
  minHeight?: string;
  containerClassName?: string;
  contentClassName?: string;
  textStyle?: CSSProperties;
  quillSize?: string;
}

export default function ParchmentTypeWriter({
  text,
  speed = 50,
  delay = 0,
  onComplete,
  minHeight,
  containerClassName = "",
  contentClassName = "px-3 py-2",
  textStyle,
  quillSize = "18px",
}: ParchmentTypeWriterProps) {
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    setIsTyping(Boolean(text));
  }, [text]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative w-full overflow-hidden rounded ${containerClassName}`.trim()}
      style={{
        backgroundColor: PARCHMENT_STYLES.backgroundColor,
        backgroundImage: PARCHMENT_STYLES.backgroundImage,
        border: `2px solid ${PARCHMENT_STYLES.borderColor}`,
        boxShadow: PARCHMENT_STYLES.boxShadow,
        minHeight,
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
      <div className={`relative z-10 ${contentClassName}`} style={{ minHeight }}>
        <div
          className="h-full"
          style={{
            fontFamily: "Georgia, serif",
            color: PARCHMENT_STYLES.textColor,
            fontSize: "16px",
            lineHeight: "1.6",
            letterSpacing: "0.5px",
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
            ...textStyle,
          }}
        >
          <TypeWriter
            text={text}
            speed={speed}
            delay={delay}
            hideCursor
            onComplete={() => {
              setIsTyping(false);
              onComplete?.();
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none inline-flex align-baseline"
            style={{
              width: `calc(${quillSize} + 6px)`,
              marginLeft: "4px",
            }}
          >
            <motion.span
              initial={{ opacity: 0 }}
              animate={isTyping ? { opacity: [1, 0.5] } : { opacity: 0 }}
              transition={
                isTyping ? { duration: 0.6, repeat: Infinity } : { duration: 0.12, ease: "easeOut" }
              }
              style={{ fontSize: quillSize }}
            >
              🖋️
            </motion.span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
