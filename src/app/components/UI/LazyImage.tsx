"use client";

import { useState } from "react";
import OptimizedImage from "./OptimizedImage";
import { useLazyImage } from "@/app/hooks/useIntersectionObserver";

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
  quality?: number;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  style?: React.CSSProperties;
  dataAttributes?: Record<string, string>;
}

export default function LazyImage({
  src,
  alt,
  width,
  height,
  className = "",
  priority = false,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  quality = 85,
  placeholder = "blur",
  blurDataURL,
  onLoad,
  onError,
  style,
  dataAttributes = {},
}: LazyImageProps) {
  const { ref, isLoaded, isInView, onLoad: handleLoad } = useLazyImage();
  const [hasError, setHasError] = useState(false);

  const handleImageLoad = () => {
    handleLoad();
    onLoad?.();
  };

  const handleImageError = () => {
    setHasError(true);
    onError?.();
  };

  // Si es prioridad o ya está en vista, renderizar inmediatamente
  if (priority || isInView) {
    return (
      <OptimizedImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        priority={priority}
        sizes={sizes}
        quality={quality}
        placeholder={placeholder}
        blurDataURL={blurDataURL}
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={style}
        dataAttributes={dataAttributes}
      />
    );
  }

  // Placeholder mientras no está en vista
  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ width, height, ...style }}
      {...dataAttributes}
    >
      <div className="absolute inset-0 bg-gray-200 animate-pulse rounded" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Cargando...</div>
      </div>
    </div>
  );
}


