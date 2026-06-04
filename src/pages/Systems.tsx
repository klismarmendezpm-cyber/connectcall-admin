import React, { useEffect, useState } from 'react';
import { Plus, Server, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { DataTable, Column } from '../components/ui/DataTable';
import { SearchInput } from '../components/ui/SearchInput';
import { FilterSelect } from '../components/ui/FilterSelect';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { logAudit } from '../lib/auditLogger';
import { formatOrgName } from '../lib/displayNames';
import { toast } from 'sonner';
interface System {
  id: number;
  org_id: number;
  system_key: string;
  system_name: string;
  vendor: string;
  login_url: string;
  created_at: string;
  orgs?: {
    name: string;
  };
}
export const Systems = () => {
  const { user, hasPermission } = useAuth();
  const canEdit = hasPermission(['admin']);
  const canDelete = hasPermission(['admin']);
  const scopedOrgIds = user?.assigned_org_ids?.length ?
  user.assigned_org_ids :
  user?.role_name === 'admin' ?
  null :
  user?.org_id ?
  [user.org_id] :
  [];
  const [systems, setSystems] = useState<System[]>([]);
  const [orgs, setOrgs] = useState<
    {
      id: number;
      name: string;
    }[]>(
    []);
  const [isLoading, setIsLoading] = useState(true);
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const systemsPerPage = 6;
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSystem, setCurrentSystem] = useState<Partial<System>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [systemToDelete, setSystemToDelete] = useState<System | null>(null);
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch orgs for dropdown
      const { data: orgData } = await supabase.
      from('orgs').
      select('id:org_id, name').
      order('name');
      setOrgs(
        (orgData || []).
        filter((org) => !scopedOrgIds || scopedOrgIds.includes(Number(org.id))).
        map((org) => ({ ...org, name: formatOrgName(org.name) }))
      );
      // Fetch systems with org join
      const { data: systemsData, error } = await supabase.
      from('systems').
      select(
        `
          id:system_id,
          org_id,
          system_key,
          system_name,
          vendor,
          login_url,
          created_at,
          orgs (name)
        `
      ).
      order('system_name');
      if (error) throw error;
      setSystems(
        (systemsData || []).
        filter((system) => !scopedOrgIds || scopedOrgIds.includes(Number(system.org_id))).
        map((system: any) => ({
          ...system,
          orgs: system.orgs ? { ...system.orgs, name: formatOrgName(system.orgs.name) } : system.orgs
        }))
      );
    } catch (error) {
      console.error('Error fetching systems:', error);
      toast.error('Failed to load systems');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, orgFilter]);
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
    !currentSystem.system_name ||
    !currentSystem.org_id ||
    !currentSystem.system_key)

    return;
    setIsSubmitting(true);
    try {
      const isNew = !currentSystem.id;
      const systemData = {
        org_id: currentSystem.org_id,
        system_key: currentSystem.system_key,
        system_name: currentSystem.system_name,
        vendor: currentSystem.vendor || null,
        login_url: currentSystem.login_url || null
      };
      let savedSystem;
      if (isNew) {
        const { data, error } = await supabase.
        from('systems').
        insert([
        {
          ...systemData,
          created_at: new Date().toISOString()
        }]
        ).
        select('id:system_id, org_id, system_key, system_name, vendor, login_url, created_at, orgs(name)').
        single();
        if (error) throw error;
        savedSystem = data;
        toast.success('System created successfully');
      } else {
        const { data, error } = await supabase.
        from('systems').
        update(systemData).
        eq('system_id', currentSystem.id).
        select('id:system_id, org_id, system_key, system_name, vendor, login_url, created_at, orgs(name)').
        single();
        if (error) throw error;
        savedSystem = data;
        toast.success('System updated successfully');
      }
      await logAudit({
        actor: user?.username || 'unknown',
        action: isNew ? 'create' : 'update',
        entity: 'systems',
        entity_id: savedSystem?.id || currentSystem.id,
        metadata: {
          name: systemData.system_name
        }
      });
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving system:', error);
      toast.error('Failed to save system');
      // Prototype fallback
      const orgName =
      orgs.find((o) => o.id === Number(currentSystem.org_id))?.name ||
      'Unknown';
      if (!currentSystem.id) {
        setSystems([
        ...systems,
        {
          ...currentSystem,
          id: Date.now(),
          created_at: new Date().toISOString(),
          orgs: {
            name: orgName
          }
        } as System]
        );
      } else {
        setSystems(
          systems.map((s) =>
          s.id === currentSystem.id ?
          {
            ...s,
            ...currentSystem,
            orgs: {
              name: orgName
            }
          } as System :
          s
          )
        );
      }
      setIsModalOpen(false);
      toast.success('System saved (Prototype mode)');
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDelete = async () => {
    if (!systemToDelete) return;
    try {
      // In a real app, check for linked accounts first
      const { error } = await supabase.
      from('systems').
      delete().
      eq('system_id', systemToDelete.id);
      if (error) throw error;
      await logAudit({
        actor: user?.username || 'unknown',
        action: 'delete',
        entity: 'systems',
        entity_id: systemToDelete.id,
        metadata: {
          name: systemToDelete.system_name
        }
      });
      toast.success('System deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting system:', error);
      toast.error('Failed to delete system');
      // Prototype fallback
      setSystems(systems.filter((s) => s.id !== systemToDelete.id));
      toast.success('System deleted (Prototype mode)');
    } finally {
      setDeleteConfirmOpen(false);
      setSystemToDelete(null);
    }
  };
  const filteredSystems = systems.filter((system) => {
    const matchesSearch =
    system.system_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    system.system_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    system.vendor &&
    system.vendor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesOrg = orgFilter ? system.org_id.toString() === orgFilter : true;
    return matchesSearch && matchesOrg;
  });
  const totalPages = Math.max(1, Math.ceil(filteredSystems.length / systemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * systemsPerPage;
  const paginatedSystems = filteredSystems.slice(
    pageStart,
    pageStart + systemsPerPage
  );
  const columns: Column<System>[] = [
  {
    header: 'System Name',
    accessor: (row) =>
    <div className="flex items-center">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 mr-3">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <div className="font-medium text-slate-900">{row.system_name}</div>
            <div className="text-xs text-slate-500 font-mono">
              {row.system_key}
            </div>
          </div>
        </div>,

    sortable: true,
    sortKey: 'system_name'
  },
  {
    header: 'Organization',
    accessor: (row) => formatOrgName(row.orgs?.name) || 'Unknown'
  },
  {
    header: 'Vendor',
    accessor: (row) => row.vendor || '-'
  },
  {
    header: 'Login URL',
    accessor: (row) =>
    row.login_url ?
    <a
      href={row.login_url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center text-brand-accent hover:underline"
      onClick={(e) => e.stopPropagation()}>
      
            Open Link <ExternalLink className="w-3 h-3 ml-1" />
          </a> :

    '-'

  }];

  if (canEdit) {
    columns.push({
      header: 'Actions',
      accessor: (row) =>
      <div className="flex items-center space-x-2">
          <button
          onClick={(e) => {
            e.stopPropagation();
            setCurrentSystem(row);
            setIsModalOpen(true);
          }}
          className="p-1 text-slate-400 hover:text-brand-primary transition-colors"
          title="Edit">
          
            <Edit2 className="w-4 h-4" />
          </button>
          {canDelete &&
          <button
          onClick={(e) => {
            e.stopPropagation();
            setSystemToDelete(row);
            setDeleteConfirmOpen(true);
          }}
          className="p-1 text-slate-400 hover:text-brand-danger transition-colors"
          title="Delete">
          
            <Trash2 className="w-4 h-4" />
          </button>
          }
        </div>,

      className: 'text-right'
    });
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Systems & Platforms
          </h2>
          <p className="text-slate-500 mt-1">
            Manage target systems where credentials reside
          </p>
        </div>
        {canEdit &&
        <button
          onClick={() => {
            setCurrentSystem({});
            setIsModalOpen(true);
          }}
          className="btn-primary flex items-center">
          
            <Plus className="w-4 h-4 mr-2" />
            Add System
          </button>
        }
      </div>

      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name, key, or vendor..." />
            
          </div>
          <div className="w-full md:w-64">
            <FilterSelect
              value={orgFilter}
              onChange={setOrgFilter}
              options={orgs.map((o) => ({
                label: o.name,
                value: o.id.toString()
              }))}
              placeholder="All Organizations" />
            
          </div>
        </div>

        <DataTable
          columns={columns}
          data={paginatedSystems}
          isLoading={isLoading}
          emptyMessage="No systems found matching your filters." />

        {filteredSystems.length > systemsPerPage &&
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 text-sm">
            <div className="text-slate-500">
              Showing {pageStart + 1}-
              {Math.min(pageStart + systemsPerPage, filteredSystems.length)} of{' '}
              {filteredSystems.length} systems
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

      {/* Create/Edit Modal */}
      {isModalOpen &&
      <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
            className="fixed inset-0 transition-opacity bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)} />
          

            <div className="relative inline-block w-full max-w-lg p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <h3 className="text-lg font-medium leading-6 text-slate-900 mb-4 border-b border-slate-100 pb-3">
                {currentSystem.id ? 'Edit System' : 'Add System'}
              </h3>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">
                      System Name <span className="text-red-500">*</span>
                    </label>
                    <input
                    type="text"
                    required
                    value={currentSystem.system_name || ''}
                    onChange={(e) =>
                    setCurrentSystem({
                      ...currentSystem,
                      system_name: e.target.value
                    })
                    }
                    className="input-field mt-1"
                    placeholder="e.g. Production Database" />
                  
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      System Key <span className="text-red-500">*</span>
                    </label>
                    <input
                    type="text"
                    required
                    value={currentSystem.system_key || ''}
                    onChange={(e) =>
                    setCurrentSystem({
                      ...currentSystem,
                      system_key: e.target.value
                    })
                    }
                    className="input-field mt-1 font-mono text-sm"
                    placeholder="e.g. SYS-PROD-DB" />
                  
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Organization <span className="text-red-500">*</span>
                    </label>
                    <select
                    required
                    value={currentSystem.org_id || ''}
                    onChange={(e) =>
                    setCurrentSystem({
                      ...currentSystem,
                      org_id: Number(e.target.value)
                    })
                    }
                    className="input-field mt-1">
                    
                      <option value="">Select Organization</option>
                      {orgs.map((org) =>
                    <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                    )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Vendor
                    </label>
                    <input
                    type="text"
                    value={currentSystem.vendor || ''}
                    onChange={(e) =>
                    setCurrentSystem({
                      ...currentSystem,
                      vendor: e.target.value
                    })
                    }
                    className="input-field mt-1"
                    placeholder="e.g. AWS, Microsoft" />
                  
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Login URL
                    </label>
                    <input
                    type="url"
                    value={currentSystem.login_url || ''}
                    onChange={(e) =>
                    setCurrentSystem({
                      ...currentSystem,
                      login_url: e.target.value
                    })
                    }
                    className="input-field mt-1"
                    placeholder="https://..." />
                  
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 sm:flex sm:flex-row-reverse">
                  <button
                  type="submit"
                  disabled={
                  isSubmitting ||
                  !currentSystem.system_name ||
                  !currentSystem.org_id ||
                  !currentSystem.system_key
                  }
                  className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                  
                    {isSubmitting ? 'Saving...' : 'Save System'}
                  </button>
                  <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                  
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      }

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Delete System"
        message={`Are you sure you want to delete ${systemToDelete?.system_name}? This action cannot be undone and will fail if accounts are linked.`}
        confirmLabel="Delete"
        isDanger={true}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setSystemToDelete(null);
        }} />
      
    </div>);

};
