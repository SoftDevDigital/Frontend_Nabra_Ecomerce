// Sistema de analytics optimizado para NABRA

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

export interface AnalyticsEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
  custom_parameters?: Record<string, any>;
}

export interface EcommerceEvent {
  event: 'purchase' | 'add_to_cart' | 'remove_from_cart' | 'view_item' | 'view_item_list' | 'begin_checkout';
  currency: string;
  value: number;
  items: Array<{
    item_id: string;
    item_name: string;
    category: string;
    quantity: number;
    price: number;
  }>;
}

class Analytics {
  private isInitialized = false;
  private measurementId: string;

  constructor() {
    this.measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
  }

  // Inicializar Google Analytics
  init() {
    if (typeof window === 'undefined' || this.isInitialized) return;

    // Cargar Google Analytics de forma asíncrona
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
    document.head.appendChild(script);

    // Configurar gtag
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };

    window.gtag('js', new Date());
    window.gtag('config', this.measurementId, {
      page_title: document.title,
      page_location: window.location.href,
      send_page_view: true,
    });

    this.isInitialized = true;
  }

  // Trackear evento personalizado
  trackEvent(event: AnalyticsEvent) {
    if (!this.isInitialized) return;

    window.gtag('event', event.action, {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
      ...event.custom_parameters,
    });
  }

  // Trackear evento de ecommerce
  trackEcommerceEvent(event: EcommerceEvent) {
    if (!this.isInitialized) return;

    window.gtag('event', event.event, {
      currency: event.currency,
      value: event.value,
      items: event.items,
    });
  }

  // Trackear vista de página
  trackPageView(pagePath: string, pageTitle?: string) {
    if (!this.isInitialized) return;

    window.gtag('config', this.measurementId, {
      page_path: pagePath,
      page_title: pageTitle || document.title,
    });
  }

  // Trackear conversión
  trackConversion(conversionId: string, value?: number, currency = 'MXN') {
    if (!this.isInitialized) return;

    window.gtag('event', 'conversion', {
      send_to: conversionId,
      value: value,
      currency: currency,
    });
  }

  // Trackear tiempo de carga
  trackPageLoadTime() {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      
      this.trackEvent({
        action: 'page_load_time',
        category: 'Performance',
        label: 'Page Load',
        value: Math.round(loadTime),
      });
    });
  }

  // Trackear errores
  trackError(error: Error, fatal = false) {
    this.trackEvent({
      action: 'javascript_error',
      category: 'Error',
      label: error.message,
      custom_parameters: {
        fatal: fatal,
        error_stack: error.stack,
      },
    });
  }

  // Trackear interacciones de usuario
  trackUserInteraction(element: string, action: string, value?: string) {
    this.trackEvent({
      action: action,
      category: 'User Interaction',
      label: element,
      custom_parameters: {
        element_value: value,
      },
    });
  }

  // Trackear búsquedas
  trackSearch(searchTerm: string, resultsCount?: number) {
    this.trackEvent({
      action: 'search',
      category: 'Search',
      label: searchTerm,
      value: resultsCount,
    });
  }

  // Trackear scroll depth
  trackScrollDepth() {
    if (typeof window === 'undefined') return;

    let maxScroll = 0;
    const scrollThresholds = [25, 50, 75, 90, 100];
    const trackedThresholds = new Set<number>();

    const trackScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      );

      if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;

        scrollThresholds.forEach(threshold => {
          if (scrollPercent >= threshold && !trackedThresholds.has(threshold)) {
            trackedThresholds.add(threshold);
            this.trackEvent({
              action: 'scroll_depth',
              category: 'Engagement',
              label: `${threshold}%`,
              value: threshold,
            });
          }
        });
      }
    };

    window.addEventListener('scroll', trackScroll, { passive: true });
  }
}

// Instancia global
export const analytics = new Analytics();

// Hook para usar analytics en componentes React
export function useAnalytics() {
  return {
    trackEvent: analytics.trackEvent.bind(analytics),
    trackEcommerceEvent: analytics.trackEcommerceEvent.bind(analytics),
    trackPageView: analytics.trackPageView.bind(analytics),
    trackConversion: analytics.trackConversion.bind(analytics),
    trackUserInteraction: analytics.trackUserInteraction.bind(analytics),
    trackSearch: analytics.trackSearch.bind(analytics),
  };
}

// Eventos específicos de ecommerce
export const ecommerceEvents = {
  // Producto visto
  viewItem: (product: { id: string; name: string; category: string; price: number }) => ({
    event: 'view_item' as const,
    currency: 'MXN',
    value: product.price,
    items: [{
      item_id: product.id,
      item_name: product.name,
      category: product.category,
      quantity: 1,
      price: product.price,
    }],
  }),

  // Producto agregado al carrito
  addToCart: (product: { id: string; name: string; category: string; price: number; quantity: number }) => ({
    event: 'add_to_cart' as const,
    currency: 'MXN',
    value: product.price * product.quantity,
    items: [{
      item_id: product.id,
      item_name: product.name,
      category: product.category,
      quantity: product.quantity,
      price: product.price,
    }],
  }),

  // Inicio de checkout
  beginCheckout: (items: Array<{ id: string; name: string; category: string; price: number; quantity: number }>) => ({
    event: 'begin_checkout' as const,
    currency: 'MXN',
    value: items.reduce((total, item) => total + (item.price * item.quantity), 0),
    items: items.map(item => ({
      item_id: item.id,
      item_name: item.name,
      category: item.category,
      quantity: item.quantity,
      price: item.price,
    })),
  }),

  // Compra completada
  purchase: (transactionId: string, items: Array<{ id: string; name: string; category: string; price: number; quantity: number }>) => ({
    event: 'purchase' as const,
    currency: 'MXN',
    value: items.reduce((total, item) => total + (item.price * item.quantity), 0),
    items: items.map(item => ({
      item_id: item.id,
      item_name: item.name,
      category: item.category,
      quantity: item.quantity,
      price: item.price,
    })),
    transaction_id: transactionId,
  }),
};


