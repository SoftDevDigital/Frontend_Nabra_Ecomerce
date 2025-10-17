"use client";

import s from "./Spinner.module.css";

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray';
  className?: string;
}

export default function Spinner({ size = 'md', color = 'primary', className = '' }: SpinnerProps) {
  return (
    <div className={`${s.spinner} ${s[size]} ${s[color]} ${className}`}>
      <div className={s.ring}></div>
      <div className={s.ring}></div>
      <div className={s.ring}></div>
    </div>
  );
}

