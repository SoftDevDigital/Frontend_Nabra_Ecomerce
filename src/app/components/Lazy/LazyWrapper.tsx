"use client";

import { Suspense, ReactNode, useState, useEffect } from "react";

interface LazyWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  delay?: number;
}

const DefaultFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
  </div>
);

export default function LazyWrapper({ 
  children, 
  fallback = <DefaultFallback />,
  delay = 0 
}: LazyWrapperProps) {
  if (delay > 0) {
    return (
      <Suspense fallback={fallback}>
        <DelayedComponent delay={delay}>
          {children}
        </DelayedComponent>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}

function DelayedComponent({ 
  children, 
  delay 
}: { 
  children: ReactNode; 
  delay: number 
}) {
  // Simular delay para componentes que no necesitan cargar inmediatamente
  if (typeof window !== "undefined") {
    const [isReady, setIsReady] = useState(false);
    
    useEffect(() => {
      const timer = setTimeout(() => setIsReady(true), delay);
      return () => clearTimeout(timer);
    }, [delay]);

    if (!isReady) {
      return <div className="animate-pulse bg-gray-200 rounded h-32" />;
    }
  }

  return <>{children}</>;
}
