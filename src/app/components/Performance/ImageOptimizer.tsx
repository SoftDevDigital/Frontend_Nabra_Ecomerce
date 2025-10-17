"use client";

import { useEffect } from "react";

export default function ImageOptimizer() {
  useEffect(() => {
    // Preload de imágenes críticas
    const preloadCriticalImages = () => {
      const criticalImages = [
        '/logoNabra.png',
        '/zapateria.jpeg',
      ];

      criticalImages.forEach(src => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = src;
        link.as = 'image';
        document.head.appendChild(link);
      });
    };

    // Optimizar carga de imágenes
    const optimizeImageLoading = () => {
      const images = document.querySelectorAll('img');
      
      images.forEach(img => {
        // Agregar loading="lazy" a imágenes no críticas
        if (!img.hasAttribute('loading') && !img.closest('[data-priority]')) {
          img.setAttribute('loading', 'lazy');
        }

        // Agregar decoding="async" para mejor performance
        if (!img.hasAttribute('decoding')) {
          img.setAttribute('decoding', 'async');
        }

        // Prevenir layout shift con aspect-ratio
        if (!img.style.aspectRatio && img.naturalWidth && img.naturalHeight) {
          img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        }
      });
    };

    // Observer para imágenes que se cargan dinámicamente
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          
          // Optimizar imagen cuando entra en viewport
          if (!img.hasAttribute('loading')) {
            img.setAttribute('loading', 'lazy');
          }
          
          if (!img.hasAttribute('decoding')) {
            img.setAttribute('decoding', 'async');
          }

          // Prevenir layout shift
          if (img.naturalWidth && img.naturalHeight && !img.style.aspectRatio) {
            img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
          }
        }
      });
    });

    // Observar todas las imágenes
    const images = document.querySelectorAll('img');
    images.forEach(img => imageObserver.observe(img));

    preloadCriticalImages();
    optimizeImageLoading();

    return () => {
      imageObserver.disconnect();
    };
  }, []);

  return null;
}


