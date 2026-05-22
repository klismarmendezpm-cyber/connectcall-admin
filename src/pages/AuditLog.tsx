import React, { useEffect, useState } from 'react';
import { History, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { DataTable, Column } from '../components/ui/DataTable';
import { SearchInput } from '../components/ui/SearchInput';
import { FilterSelect } from '../components/ui/FilterSelect';
import { format } from 'date-fns';
import { toast } from 'sonner';
interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: any;
  created_at: string;
}
export const AuditLog = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 6;
  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.
      from('audit_log').
      select('id:audit_id, actor, action, entity, entity_id, metadata').
      order('audit_id', {
        ascending: false
      }).
      limit(500); // Limit for performance
      if (error) throw error;
      setLogs(
        (data || []).map((log: any) => ({
          ...log,
          entity_id: log.entity_id?.toString() || null,
          created_at: new Date().toISOString()
        }))
      );
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchLogs();
  }, []);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, actionFilter, entityFilter]);
  // Extract unique actions and entities for filters
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action))).sort();
  const uniqueEntities = Array.from(new Set(logs.map((l) => l.entity))).sort();
  const filteredLogs = logs.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
    log.actor.toLowerCase().includes(searchLower) ||
    log.entity_id && log.entity_id.toLowerCase().includes(searchLower) ||
    log.metadata &&
    JSON.stringify(log.metadata).toLowerCase().includes(searchLower);
    const matchesAction = actionFilter ? log.action === actionFilter : true;
    const matchesEntity = entityFilter ? log.entity === entityFilter : true;
    return matchesSearch && matchesAction && matchesEntity;
  });
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / logsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * logsPerPage;
  const paginatedLogs = filteredLogs.slice(
    pageStart,
    pageStart + logsPerPage
  );
  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'update':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'delete':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'view':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'login':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'login_failed':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };
  const columns: Column<AuditEntry>[] = [
  {
    header: 'Timestamp',
    accessor: (row) =>
    <div className="text-sm text-slate-900 whitespace-nowrap">
          {format(new Date(row.created_at), 'MMM d, yyyy HH:mm:ss')}
        </div>,

    sortable: true,
    sortKey: 'created_at'
  },
  {
    header: 'Actor',
    accessor: (row) =>
    <div className="font-medium text-slate-900">{row.actor}</div>,

    sortable: true,
    sortKey: 'actor'
  },
  {
    header: 'Action',
    accessor: (row) =>
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getActionColor(row.action)}`}>
      
          {row.action.toUpperCase()}
        </span>

  },
  {
    header: 'Entity / Target',
    accessor: (row) =>
    <div>
          <div className="text-sm font-medium text-slate-900">{row.entity}</div>
          {row.entity_id &&
      <div className="text-xs text-slate-500 font-mono">
              ID: {row.entity_id}
            </div>
      }
        </div>

  },
  {
    header: 'Metadata',
    accessor: (row) =>
    row.metadata ?
    <div className="text-xs font-mono bg-slate-50 p-2 rounded border border-slate-200 max-w-xs overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(row.metadata, null, 2)}
          </div> :

    <span className="text-slate-400 text-sm">-</span>

  }];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center">
            <History className="w-6 h-6 mr-2 text-brand-primary" />
            Audit Log
          </h2>
          <p className="text-slate-500 mt-1">
            Immutable record of all system activity
          </p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by actor, ID, or metadata..." />
            
          </div>
          <div className="w-full md:w-48">
            <FilterSelect
              value={actionFilter}
              onChange={setActionFilter}
              options={uniqueActions.map((a) => ({
                label: a.toUpperCase(),
                value: a
              }))}
              placeholder="All Actions" />
            
          </div>
          <div className="w-full md:w-48">
            <FilterSelect
              value={entityFilter}
              onChange={setEntityFilter}
              options={uniqueEntities.map((e) => ({
                label: e,
                value: e
              }))}
              placeholder="All Entities" />
            
          </div>
        </div>

        <DataTable
          columns={columns}
          data={paginatedLogs}
          isLoading={isLoading}
          emptyMessage="No audit logs found matching your filters." />

        {filteredLogs.length > logsPerPage &&
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 text-sm">
            <div className="text-slate-500">
              Showing {pageStart + 1}-
              {Math.min(pageStart + logsPerPage, filteredLogs.length)} of{' '}
              {filteredLogs.length} audit logs
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safeCurrentPage === 1}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40">
                Previous
              </button>
              <span className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
              type="button"
              onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={safeCurrentPage === totalPages}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        }
        
      </div>
    </div>);

};
