import React, { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, Search } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { DataTable, Column } from '../components/ui/DataTable';
import { SearchInput } from '../components/ui/SearchInput';
import { FilterSelect } from '../components/ui/FilterSelect';
import { format } from 'date-fns';
import { toast } from 'sonner';
interface LoginAttempt {
  id: number;
  username: string;
  ip_address: string | null;
  success: boolean;
  created_at: string;
}
export const LoginAttempts = () => {
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const attemptsPerPage = 6;
  const fetchAttempts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.
      from('auth_login_attempts').
      select('id:attempt_id, username, ip_address, success, created_at').
      order('created_at', {
        ascending: false
      }).
      limit(200);
      if (error) throw error;
      setAttempts(
        (data || []).map((attempt: any) => ({
          ...attempt,
          success: attempt.success === true || attempt.success === 1
        }))
      );
    } catch (error) {
      console.error('Error fetching login attempts:', error);
      toast.error('Failed to load login attempts');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchAttempts();
  }, []);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);
  const filteredAttempts = attempts.filter((attempt) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
    attempt.username.toLowerCase().includes(searchLower) ||
    attempt.ip_address &&
    attempt.ip_address.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter ?
    attempt.success.toString() === statusFilter :
    true;
    return matchesSearch && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredAttempts.length / attemptsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * attemptsPerPage;
  const paginatedAttempts = filteredAttempts.slice(
    pageStart,
    pageStart + attemptsPerPage
  );
  const columns: Column<LoginAttempt>[] = [
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
    header: 'Username',
    accessor: (row) =>
    <span className="font-mono text-sm font-medium text-slate-900">
          {row.username}
        </span>,

    sortable: true,
    sortKey: 'username'
  },
  {
    header: 'IP Address',
    accessor: (row) =>
    <span className="font-mono text-xs text-slate-500">
          {row.ip_address || 'Unknown'}
        </span>

  },
  {
    header: 'Status',
    accessor: (row) =>
    <div className="flex items-center">
          {row.success ?
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
              <ShieldCheck className="w-3 h-3 mr-1" /> Success
            </span> :

      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
              <ShieldAlert className="w-3 h-3 mr-1" /> Failed
            </span>
      }
        </div>

  }];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center">
            <ShieldAlert className="w-6 h-6 mr-2 text-brand-primary" />
            Login Attempts
          </h2>
          <p className="text-slate-500 mt-1">
            Monitor authentication events and potential threats
          </p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by username or IP address..." />
            
          </div>
          <div className="w-full md:w-48">
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
              {
                label: 'Success',
                value: 'true'
              },
              {
                label: 'Failed',
                value: 'false'
              }]
              }
              placeholder="All Statuses" />
            
          </div>
        </div>

        <DataTable
          columns={columns}
          data={paginatedAttempts}
          isLoading={isLoading}
          emptyMessage="No login attempts found matching your filters." />

        {filteredAttempts.length > attemptsPerPage &&
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 text-sm">
            <div className="text-slate-500">
              Showing {pageStart + 1}-
              {Math.min(pageStart + attemptsPerPage, filteredAttempts.length)} of{' '}
              {filteredAttempts.length} login attempts
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
