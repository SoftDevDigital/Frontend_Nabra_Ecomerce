"use client";

import { useEffect } from "react";
import { useWebVitals } from "@/app/hooks/usePerformance";

export default function WebVitalsOptimizer() {
  useWebVitals();

  useEffect(() => {
    // Optimización de LCP - Preload de recursos críticos
    const preloadCriticalResources = () => {
      // Preload de la imagen hero
      const heroImage = document.querySelector('img[alt*="hero"], img[alt*="Hero"]');
      if (heroImage) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = heroImage.getAttribute('src') || '';
        link.as = 'image';
        document.head.appendChild(link);
      }

      // Preload de fuentes críticas
      const fontLink = document.createElement('link');
      fontLink.rel = 'preload';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
      fontLink.as = 'style';
      document.head.appendChild(fontLink);
    };

    // Optimización de CLS - Reservar espacio para imágenes
    const preventLayoutShift = () => {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (!img.style.aspectRatio && img.width && img.height) {
          img.style.aspectRatio = `${img.width} / ${img.height}`;
        }
      });
    };

    // Optimización de FID - Reducir JavaScript bloqueante
    const optimizeJavaScript = () => {
      // Defer scripts no críticos
      const scripts = document.querySelectorAll('script[src]');
      scripts.forEach(script => {
        if (!script.hasAttribute('defer') && !script.hasAttribute('async')) {
          script.setAttribute('defer', '');
        }
      });
    };

    // Ejecutar optimizaciones
    preloadCriticalResources();
    preventLayoutShift();
    optimizeJavaScript();

    // Observer para imágenes que se cargan dinámicamente
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          if (img.width && img.height && !img.style.aspectRatio) {
            img.style.aspectRatio = `${img.width} / ${img.height}`;
          }
        }
      });
    });

    // Observar todas las imágenes
    const images = document.querySelectorAll('img');
    images.forEach(img => imageObserver.observe(img));

    return () => {
      imageObserver.disconnect();
    };
  }, []);

  return null;
}


