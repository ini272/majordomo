import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export default function TypeWriter({ text, speed = 50, delay = 0, onComplete, hideCursor = false }) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  // Use ref for callback to avoid effect re-runs when parent re-renders
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!text) return;

    let index = 0;
    let timeoutId;
    let isMounted = true;

    const typeNextChar = () => {
      if (!isMounted) return;

      if (index < text.length) {
        setDisplayedText(text.substring(0, index + 1));
        index++;
        timeoutId = setTimeout(typeNextChar, speed);
      } else {
        setIsComplete(true);
        onCompleteRef.current?.();
      }
    };

    // Start after delay
    timeoutId = setTimeout(typeNextChar, delay);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [text, speed, delay]);

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {displayedText}
      {!isComplete && !hideCursor && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          style={{ marginLeft: '2px' }}
        >
          |
        </motion.span>
      )}
    </motion.span>
  );
}
