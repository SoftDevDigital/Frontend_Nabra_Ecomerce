// Sistema de caché avanzado para la aplicación
import React, { useState, useEffect } from "react";

export interface CacheConfig {
  ttl: number; // Time to live en segundos
  staleWhileRevalidate?: number; // Tiempo para revalidar en background
  tags?: string[]; // Tags para invalidación selectiva
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  tags?: string[];
}

// Configuraciones de caché por tipo de contenido
export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Productos destacados - caché largo
  featured: {
    ttl: 300, // 5 minutos
    staleWhileRevalidate: 600, // 10 minutos
    tags: ['products', 'featured'],
  },
  
  // Productos individuales - caché medio
  product: {
    ttl: 300, // 5 minutos
    staleWhileRevalidate: 900, // 15 minutos
    tags: ['products'],
  },
  
  // Lista de productos - caché corto
  products: {
    ttl: 60, // 1 minuto
    staleWhileRevalidate: 300, // 5 minutos
    tags: ['products'],
  },
  
  // Categorías - caché muy largo
  categories: {
    ttl: 600, // 10 minutos
    staleWhileRevalidate: 1800, // 30 minutos
    tags: ['categories'],
  },
  
  // Media/Imágenes - caché muy largo
  media: {
    ttl: 3600, // 1 hora
    staleWhileRevalidate: 7200, // 2 horas
    tags: ['media'],
  },
  
  // Configuración del sitio - caché muy largo
  config: {
    ttl: 1800, // 30 minutos
    staleWhileRevalidate: 3600, // 1 hora
    tags: ['config'],
  },
};

// Cache en memoria para el lado del cliente
class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 100; // Máximo 100 entradas

  set<T>(key: string, data: T, config: CacheConfig): void {
    // Limpiar entradas expiradas
    this.cleanup();
    
    // Si excede el tamaño máximo, eliminar la entrada más antigua
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: config.ttl * 1000,
      tags: config.tags,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  invalidate(tags?: string[]): void {
    if (!tags) {
      this.cache.clear();
      return;
    }
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags && entry.tags.some(tag => tags.includes(tag))) {
        this.cache.delete(key);
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }
}

// Instancia global del caché
const memoryCache = new MemoryCache();

// Función para generar claves de caché consistentes
export function generateCacheKey(prefix: string, params: Record<string, any> = {}): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  
  return sortedParams ? `${prefix}:${sortedParams}` : prefix;
}

// Función principal de caché con revalidación
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: CacheConfig,
  options: {
    forceRefresh?: boolean;
    tags?: string[];
  } = {}
): Promise<T> {
  const { forceRefresh = false, tags = [] } = options;
  
  // Si no es forzado, intentar obtener del caché
  if (!forceRefresh) {
    const cached = memoryCache.get<T>(key);
    if (cached) {
      return cached;
    }
  }

  try {
    // Obtener datos frescos
    const data = await fetcher();
    
    // Guardar en caché
    memoryCache.set(key, data, config);
    
    return data;
  } catch (error) {
    // En caso de error, intentar devolver datos del caché si existen
    const cached = memoryCache.get<T>(key);
    if (cached) {
      console.warn(`Error fetching fresh data for ${key}, using cached data:`, error);
      return cached;
    }
    
    throw error;
  }
}

// Función para invalidar caché por tags
export function invalidateCache(tags: string[]): void {
  memoryCache.invalidate(tags);
}

// Función para obtener estadísticas del caché
export function getCacheStats() {
  return {
    size: memoryCache.size(),
    maxSize: 100,
  };
}

// Hook para usar caché en componentes React
export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: CacheConfig,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await withCache(key, fetcher, config);
        
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, deps);

  return { data, loading, error, refetch: () => withCache(key, fetcher, config, { forceRefresh: true }) };
}
