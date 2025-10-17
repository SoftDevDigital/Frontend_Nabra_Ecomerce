"use client";

import { useEffect } from "react";
import { analytics } from "@/lib/analytics";

export default function AnalyticsProvider() {
  useEffect(() => {
    // Inicializar analytics
    analytics.init();

    // Trackear tiempo de carga
    analytics.trackPageLoadTime();

    // Trackear scroll depth
    analytics.trackScrollDepth();

    // Trackear errores de JavaScript
    window.addEventListener('error', (event) => {
      analytics.trackError(event.error, true);
    });

    // Trackear errores de Promise
    window.addEventListener('unhandledrejection', (event) => {
      analytics.trackError(new Error(event.reason), false);
    });

    // Trackear interacciones de usuario
    const trackUserInteractions = () => {
      // Botones
      document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.closest('button')) {
          const buttonText = target.textContent?.trim() || 'Unknown Button';
          analytics.trackUserInteraction('button', 'click', buttonText);
        }
      });

      // Enlaces
      document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'A' || target.closest('a')) {
          const linkText = target.textContent?.trim() || 'Unknown Link';
          const href = target.getAttribute('href') || '';
          analytics.trackUserInteraction('link', 'click', `${linkText} (${href})`);
        }
      });

      // Formularios
      document.addEventListener('submit', (event) => {
        const form = event.target as HTMLFormElement;
        const formName = form.getAttribute('name') || form.id || 'Unknown Form';
        analytics.trackUserInteraction('form', 'submit', formName);
      });
    };

    trackUserInteractions();

    // Trackear vista de página inicial
    analytics.trackPageView(window.location.pathname, document.title);

  }, []);

  return null;
}




