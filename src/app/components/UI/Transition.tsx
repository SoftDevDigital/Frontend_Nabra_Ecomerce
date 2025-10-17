"use client";

import { ReactNode, useEffect, useState } from "react";
import s from "./Transition.module.css";

interface TransitionProps {
  children: ReactNode;
  show: boolean;
  type?: 'fade' | 'slide' | 'scale' | 'bounce';
  duration?: number;
  delay?: number;
  className?: string;
}

export default function Transition({ 
  children, 
  show, 
  type = 'fade', 
  duration = 300, 
  delay = 0,
  className = '' 
}: TransitionProps) {
  const [isVisible, setIsVisible] = useState(show);
  const [shouldRender, setShouldRender] = useState(show);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), duration);
      return () => clearTimeout(timer);
    }
  }, [show, delay, duration]);

  if (!shouldRender) return null;

  return (
    <div 
      className={`${s.transition} ${s[type]} ${isVisible ? s.visible : s.hidden} ${className}`}
      style={{ 
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  );
}

