"use client";

import Image from "next/image";
import { useState, useCallback } from "react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  fill?: boolean;
  sizes?: string;
  quality?: number;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  style?: React.CSSProperties;
  dataAttributes?: Record<string, string>;
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className = "",
  fill = false,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  quality = 85,
  placeholder = "empty",
  blurDataURL,
  onLoad,
  onError,
  style,
  dataAttributes = {},
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);

  // Generar blur placeholder si no se proporciona
  const generateBlurDataURL = (w: number, h: number) => {
    return `data:image/svg+xml;base64,${Buffer.from(
      `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f3f4f6"/></svg>`
    ).toString('base64')}`;
  };

  const finalBlurDataURL = blurDataURL || (placeholder === "blur" && width && height 
    ? generateBlurDataURL(width, height) 
    : undefined);

  if (hasError) {
    return null; // No mostrar nada si hay error
  }

  return (
    <div className={`relative ${className}`} style={style}>
      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        sizes={sizes}
        quality={quality}
        placeholder="empty"
        blurDataURL={finalBlurDataURL}
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-100 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          objectFit: 'cover',
          ...(fill && { position: 'absolute' }),
        }}
        {...dataAttributes}
      />
      {/* No mostrar loading state, solo la imagen cuando esté lista */}
    </div>
  );
}


