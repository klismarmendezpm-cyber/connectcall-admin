import React from 'react';
import { ChevronUp, ChevronDown, InboxIcon } from 'lucide-react';
export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
  sortKey?: string;
  className?: string;
}
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  sortConfig?: {
    key: string;
    direction: 'asc' | 'desc';
  } | null;
  onSort?: (key: string) => void;
}
export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data available',
  onRowClick,
  sortConfig,
  onSort
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-white rounded-xl border border-slate-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>);

  }
  if (data.length === 0) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 text-slate-500">
        <InboxIcon className="w-12 h-12 mb-4 text-slate-300" />
        <p className="text-lg font-medium text-slate-900 mb-1">
          No results found
        </p>
        <p className="text-sm">{emptyMessage}</p>
      </div>);

  }
  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map((col, idx) =>
            <th
              key={idx}
              className={`px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-slate-100' : ''} ${col.className || ''}`}
              onClick={() =>
              col.sortable && col.sortKey && onSort && onSort(col.sortKey)
              }>
              
                <div className="flex items-center space-x-1">
                  <span>{col.header}</span>
                  {col.sortable &&
                col.sortKey &&
                sortConfig?.key === col.sortKey &&
                <span className="text-brand-primary">
                        {sortConfig.direction === 'asc' ?
                  <ChevronUp className="w-3 h-3" /> :

                  <ChevronDown className="w-3 h-3" />
                  }
                      </span>
                }
                </div>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {data.map((row, rowIndex) =>
          <tr
            key={rowIndex}
            onClick={() => onRowClick && onRowClick(row)}
            className={`hover:bg-slate-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}>
            
              {columns.map((col, colIndex) =>
            <td
              key={colIndex}
              className={`px-6 py-4 whitespace-nowrap text-sm text-slate-700 ${col.className || ''}`}>
              
                  {typeof col.accessor === 'function' ?
              col.accessor(row) :
              row[col.accessor] as React.ReactNode}
                </td>
            )}
            </tr>
          )}
        </tbody>
      </table>
    </div>);

}