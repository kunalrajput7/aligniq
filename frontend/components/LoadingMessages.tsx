"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LOADING_MESSAGES = [
  "Analyzing transcript structure...",
  "Identifying meeting participants...",
  "Extracting key timestamps...",
  "Detecting chapter boundaries...",
  "Discovering action items...",
  "Finding task assignments...",
  "Identifying achievements...",
  "Detecting blockers and challenges...",
  "Analyzing participant perspectives...",
  "Applying Six Thinking Hats framework...",
  "Crafting executive summary...",
  "Generating chapter summaries...",
  "Building narrative overview...",
  "Creating mind map structure...",
  "Connecting key concepts...",
  "Organizing insights...",
  "Validating extracted data...",
  "Polishing final summary...",
  "Almost there...",
  "Finalizing your meeting insights..."
];

export function LoadingMessages() {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  const currentMessage = LOADING_MESSAGES[currentMessageIndex];

  // Typewriter effect
  useEffect(() => {
    if (!isTyping) return;

    if (displayedText.length < currentMessage.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(currentMessage.slice(0, displayedText.length + 1));
      }, 50); // 50ms per character

      return () => clearTimeout(timeout);
    } else {
      // Message fully typed, wait before moving to next
      setIsTyping(false);
    }
  }, [displayedText, currentMessage, isTyping]);

  // Cycle to next message every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => {
        const nextIndex = (prev + 1) % LOADING_MESSAGES.length;
        setDisplayedText("");
        setIsTyping(true);
        return nextIndex;
      });
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-6 flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentMessageIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2"
        >
          <span className="text-sm text-slate-600">
            {displayedText}
            <span className="animate-pulse ml-1 inline-block h-4 w-0.5 bg-blue-500" />
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
