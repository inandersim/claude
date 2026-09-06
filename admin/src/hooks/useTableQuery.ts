import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Liste ekranlarının durumu (arama, filtre, sıralama, sayfa) adres çubuğunda
 * tutulur; böylece bağlantı paylaşılabilir ve geri tuşu beklendiği gibi çalışır.
 */
export interface TableQueryState {
  page: number;
  pageSize: number;
  query: string;
  sort: string;
  dir: 'asc' | 'desc';
  filters: Record<string, string>;
}

export interface TableQueryApi extends TableQueryState {
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setQuery: (value: string) => void;
  toggleSort: (key: string) => void;
  setFilter: (key: string, value: string) => void;
  reset: () => void;
}

export function useTableQuery(options: {
  prefix?: string;
  defaultSort: string;
  defaultDir?: 'asc' | 'desc';
  filterKeys: string[];
  defaultPageSize?: number;
}): TableQueryApi {
  const { prefix = '', defaultSort, defaultDir = 'desc', filterKeys, defaultPageSize = 20 } = options;
  const [params, setParams] = useSearchParams();

  const key = useCallback((name: string) => (prefix ? `${prefix}_${name}` : name), [prefix]);

  const state = useMemo<TableQueryState>(() => {
    const filters: Record<string, string> = {};
    for (const name of filterKeys) {
      filters[name] = params.get(key(name)) ?? 'all';
    }
    return {
      page: Number(params.get(key('page')) ?? 1) || 1,
      pageSize: Number(params.get(key('size')) ?? defaultPageSize) || defaultPageSize,
      query: params.get(key('q')) ?? '',
      sort: params.get(key('sort')) ?? defaultSort,
      dir: (params.get(key('dir')) as 'asc' | 'desc' | null) ?? defaultDir,
      filters,
    };
  }, [params, filterKeys, key, defaultPageSize, defaultSort, defaultDir]);

  // Değişiklikler her zaman en güncel arama parametreleri üzerine uygulanır
  // (fonksiyonel güncelleme); art arda yapılan filtre değişiklikleri kaybolmaz.
  const update = useCallback(
    (changes: Record<string, string | number | null>, resetPage = true) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [name, value] of Object.entries(changes)) {
            const paramName = key(name);
            if (value === null || value === '' || value === 'all') next.delete(paramName);
            else next.set(paramName, String(value));
          }
          if (resetPage && !('page' in changes)) next.delete(key('page'));
          return next;
        },
        { replace: true },
      );
    },
    [key, setParams],
  );

  return {
    ...state,
    setPage: (page: number) => update({ page }, false),
    setPageSize: (size: number) => update({ size }),
    setQuery: (value: string) => update({ q: value }),
    toggleSort: (sortKey: string) =>
      update({ sort: sortKey, dir: state.sort === sortKey && state.dir === 'desc' ? 'asc' : 'desc' }),
    setFilter: (name: string, value: string) => update({ [name]: value }),
    reset: () => setParams(new URLSearchParams(), { replace: true }),
  };
}
