"use client";

import { useCallback } from "react";
import { analytics, ecommerceEvents } from "@/lib/analytics";

export function useEcommerceTracking() {
  // Trackear vista de producto
  const trackProductView = useCallback((product: {
    id: string;
    name: string;
    category: string;
    price: number;
  }) => {
    const event = ecommerceEvents.viewItem(product);
    analytics.trackEcommerceEvent(event);
  }, []);

  // Trackear producto agregado al carrito
  const trackAddToCart = useCallback((product: {
    id: string;
    name: string;
    category: string;
    price: number;
    quantity: number;
  }) => {
    const event = ecommerceEvents.addToCart(product);
    analytics.trackEcommerceEvent(event);
  }, []);

  // Trackear inicio de checkout
  const trackBeginCheckout = useCallback((items: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    quantity: number;
  }>) => {
    const event = ecommerceEvents.beginCheckout(items);
    analytics.trackEcommerceEvent(event);
  }, []);

  // Trackear compra completada
  const trackPurchase = useCallback((transactionId: string, items: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    quantity: number;
  }>) => {
    const event = ecommerceEvents.purchase(transactionId, items);
    analytics.trackEcommerceEvent(event);
  }, []);

  // Trackear búsqueda de productos
  const trackProductSearch = useCallback((searchTerm: string, resultsCount: number) => {
    analytics.trackSearch(searchTerm, resultsCount);
  }, []);

  // Trackear filtros aplicados
  const trackFilterApplied = useCallback((filterType: string, filterValue: string) => {
    analytics.trackEvent({
      action: 'filter_applied',
      category: 'Product Filter',
      label: `${filterType}: ${filterValue}`,
    });
  }, []);

  // Trackear ordenamiento
  const trackSortApplied = useCallback((sortBy: string, sortOrder: string) => {
    analytics.trackEvent({
      action: 'sort_applied',
      category: 'Product Sort',
      label: `${sortBy} ${sortOrder}`,
    });
  }, []);

  // Trackear cambio de página en catálogo
  const trackPageChange = useCallback((page: number, totalPages: number) => {
    analytics.trackEvent({
      action: 'page_change',
      category: 'Pagination',
      label: `Page ${page} of ${totalPages}`,
      value: page,
    });
  }, []);

  // Trackear abandono de carrito
  const trackCartAbandonment = useCallback((cartValue: number, itemCount: number) => {
    analytics.trackEvent({
      action: 'cart_abandonment',
      category: 'Ecommerce',
      label: `Cart with ${itemCount} items`,
      value: cartValue,
    });
  }, []);

  // Trackear recuperación de carrito
  const trackCartRecovery = useCallback((cartValue: number, itemCount: number) => {
    analytics.trackEvent({
      action: 'cart_recovery',
      category: 'Ecommerce',
      label: `Cart with ${itemCount} items`,
      value: cartValue,
    });
  }, []);

  return {
    trackProductView,
    trackAddToCart,
    trackBeginCheckout,
    trackPurchase,
    trackProductSearch,
    trackFilterApplied,
    trackSortApplied,
    trackPageChange,
    trackCartAbandonment,
    trackCartRecovery,
  };
}

