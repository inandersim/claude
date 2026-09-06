import type { ReactNode } from 'react';

import { useT } from '../i18n';
import { Empty, ErrorNote, Loading } from './ui';

export interface Column<T> {
  key: string;
  header: string;
  /** Sıralanabilir sütun (sunucu tarafı sıralama anahtarı) */
  sortable?: boolean;
  align?: 'left' | 'right';
  width?: number | string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  sort?: string;
  dir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  onRowClick?: (row: T) => void;
  caption: string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  sort,
  dir,
  onSort,
  selectable,
  selected = [],
  onSelectedChange,
  onRowClick,
  caption,
  emptyMessage,
}: DataTableProps<T>) {
  const t = useT();

  if (error) return <ErrorNote error={error} onRetry={onRetry} />;

  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(rowKey(row)));

  const toggleAll = () => {
    if (!onSelectedChange) return;
    onSelectedChange(allSelected ? [] : rows.map(rowKey));
  };

  const toggleRow = (id: string) => {
    if (!onSelectedChange) return;
    onSelectedChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {selectable ? (
              <th style={{ width: 38 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={t('common.selectAll')}
                />
              </th>
            ) : null}
            {columns.map((column) => {
              const active = sort === column.key;
              return (
                <th key={column.key} style={{ width: column.width, textAlign: column.align ?? 'left' }}>
                  {column.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      aria-label={`${column.header} — ${active && dir === 'asc' ? t('common.sortDesc') : t('common.sortAsc')}`}
                      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      {column.header}
                      <span aria-hidden="true">{active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>
                <Loading />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>
                <Empty message={emptyMessage} />
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = rowKey(row);
              const isSelected = selected.includes(id);
              return (
                <tr
                  key={id}
                  className={isSelected ? 'selected' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {selectable ? (
                    <td onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(id)}
                        aria-label={`${caption} — ${id}`}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.key} style={{ textAlign: column.align ?? 'left' }}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
