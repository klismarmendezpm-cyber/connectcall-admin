import React, { useEffect, useState } from 'react';
import { Plus, Building2, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { DataTable, Column } from '../components/ui/DataTable';
import { SearchInput } from '../components/ui/SearchInput';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { logAudit } from '../lib/auditLogger';
import { formatOrgName } from '../lib/displayNames';
import { toast } from 'sonner';
import { format } from 'date-fns';
interface Organization {
  id: number;
  name: string;
  notes: string;
  created_at: string;
  people_count?: number;
  systems_count?: number;
}
export const Organizations = () => {
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
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentOrg, setCurrentOrg] = useState<Partial<Organization>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
  const fetchOrgs = async () => {
    setIsLoading(true);
    try {
      // In a real app, this would be a view or RPC to get counts efficiently
      // For the prototype, we'll fetch orgs and then try to get counts
      const { data: orgData, error: orgError } = await supabase.
      from('orgs').
      select('id:org_id, name, notes, created_at').
      order('name');
      if (orgError) throw orgError;
      if (orgData) {
        const visibleOrgData = orgData.filter(
          (org) => !scopedOrgIds || scopedOrgIds.includes(Number(org.id))
        );
        const enrichedOrgs = await Promise.all(visibleOrgData.map(async (org) => {
          const [{ count: peopleCount }, { count: systemsCount }] =
          await Promise.all([
          supabase.from('people').select('*', {
            count: 'exact',
            head: true
          }).eq('org_id', org.id),
          supabase.from('systems').select('*', {
            count: 'exact',
            head: true
          }).eq('org_id', org.id)]
          );
          return {
          ...org,
          name: formatOrgName(org.name),
          people_count: peopleCount || 0,
          systems_count: systemsCount || 0
          };
        }));
        setOrgs(enrichedOrgs);
      } else {
        setOrgs([]);
      }
    } catch (error) {
      console.error('Error fetching orgs:', error);
      toast.error('Failed to load organizations');
      setOrgs([]);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchOrgs();
  }, []);
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg.name) return;
    setIsSubmitting(true);
    try {
      const isNew = !currentOrg.id;
      const orgData = {
        name: currentOrg.name,
        notes: currentOrg.notes || ''
      };
      let savedOrg;
      if (isNew) {
        const { data, error } = await supabase.
        from('orgs').
        insert([
        {
          ...orgData,
          created_at: new Date().toISOString()
        }]
        ).
        select('id:org_id, name, notes, created_at').
        single();
        if (error) throw error;
        savedOrg = data;
        toast.success('Organization created successfully');
      } else {
        const { data, error } = await supabase.
        from('orgs').
        update(orgData).
        eq('org_id', currentOrg.id).
        select('id:org_id, name, notes, created_at').
        single();
        if (error) throw error;
        savedOrg = data;
        toast.success('Organization updated successfully');
      }
      await logAudit({
        actor: user?.username || 'unknown',
        action: isNew ? 'create' : 'update',
        entity: 'orgs',
        entity_id: savedOrg?.id || currentOrg.id,
        metadata: {
          name: orgData.name
        }
      });
      setIsModalOpen(false);
      fetchOrgs();
    } catch (error) {
      console.error('Error saving org:', error);
      toast.error('Failed to save organization');
      // For prototype: update local state anyway
      if (!currentOrg.id) {
        setOrgs([
        ...orgs,
        {
          ...currentOrg,
          id: Date.now(),
          created_at: new Date().toISOString(),
          people_count: 0,
          systems_count: 0
        } as Organization]
        );
      } else {
        setOrgs(
          orgs.map((o) =>
          o.id === currentOrg.id ?
          {
            ...o,
            ...currentOrg
          } as Organization :
          o
          )
        );
      }
      setIsModalOpen(false);
      toast.success('Organization saved (Prototype mode)');
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDelete = async () => {
    if (!orgToDelete) return;
    try {
      // In a real app, we'd check for related records first
      if (orgToDelete.people_count && orgToDelete.people_count > 0) {
        toast.error('Cannot delete organization with linked people');
        setDeleteConfirmOpen(false);
        return;
      }
      const { error } = await supabase.
      from('orgs').
      delete().
      eq('org_id', orgToDelete.id);
      if (error) throw error;
      await logAudit({
        actor: user?.username || 'unknown',
        action: 'delete',
        entity: 'orgs',
        entity_id: orgToDelete.id,
        metadata: {
          name: orgToDelete.name
        }
      });
      toast.success('Organization deleted successfully');
      fetchOrgs();
    } catch (error) {
      console.error('Error deleting org:', error);
      toast.error('Failed to delete organization');
      // For prototype: update local state anyway
      setOrgs(orgs.filter((o) => o.id !== orgToDelete.id));
      toast.success('Organization deleted (Prototype mode)');
    } finally {
      setDeleteConfirmOpen(false);
      setOrgToDelete(null);
    }
  };
  const filteredOrgs = orgs.filter(
    (org) =>
    formatOrgName(org.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.notes &&
    org.notes.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const columns: Column<Organization>[] = [
  {
    header: 'Organization Name',
    accessor: (row) =>
    <div className="flex items-center">
          <Building2 className="w-4 h-4 text-slate-400 mr-2" />
          <span className="font-medium text-slate-900">{formatOrgName(row.name)}</span>
        </div>,

    sortable: true,
    sortKey: 'name'
  },
  {
    header: 'Notes',
    accessor: (row) =>
    <span className="text-slate-500 truncate max-w-xs block">
          {row.notes || '-'}
        </span>

  },
  {
    header: 'People',
    accessor: (row) =>
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {row.people_count || 0}
        </span>

  },
  {
    header: 'Systems',
    accessor: (row) =>
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
          {row.systems_count || 0}
        </span>

  },
  {
    header: 'Created',
    accessor: (row) => format(new Date(row.created_at), 'MMM d, yyyy')
  }];

  if (canEdit) {
    columns.push({
      header: 'Actions',
      accessor: (row) =>
      <div className="flex items-center space-x-2">
          <button
          onClick={(e) => {
            e.stopPropagation();
            setCurrentOrg(row);
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
            setOrgToDelete(row);
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
          <h2 className="text-2xl font-bold text-slate-900">Organizations</h2>
          <p className="text-slate-500 mt-1">
            Manage client and partner organizations
          </p>
        </div>
        {canEdit &&
        <button
          onClick={() => {
            setCurrentOrg({});
            setIsModalOpen(true);
          }}
          className="btn-primary flex items-center">
          
            <Plus className="w-4 h-4 mr-2" />
            Add Organization
          </button>
        }
      </div>

      <div className="card p-4">
        <div className="mb-4 max-w-md">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search organizations..." />
          
        </div>

        <DataTable
          columns={columns}
          data={filteredOrgs}
          isLoading={isLoading}
          emptyMessage="No organizations found matching your search." />
        
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen &&
      <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
            className="fixed inset-0 transition-opacity bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)} />
          

            <div className="relative inline-block w-full max-w-md p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <h3 className="text-lg font-medium leading-6 text-slate-900 mb-4">
                {currentOrg.id ? 'Edit Organization' : 'Add Organization'}
              </h3>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label
                  htmlFor="name"
                  className="block text-sm font-medium text-slate-700">
                  
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                  type="text"
                  id="name"
                  required
                  value={currentOrg.name || ''}
                  onChange={(e) =>
                  setCurrentOrg({
                    ...currentOrg,
                    name: e.target.value
                  })
                  }
                  className="input-field mt-1"
                  placeholder="e.g. Acme Corp" />
                
                </div>

                <div>
                  <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-slate-700">
                  
                    Notes
                  </label>
                  <textarea
                  id="notes"
                  rows={3}
                  value={currentOrg.notes || ''}
                  onChange={(e) =>
                  setCurrentOrg({
                    ...currentOrg,
                    notes: e.target.value
                  })
                  }
                  className="input-field mt-1 resize-none"
                  placeholder="Optional details about this organization..." />
                
                </div>

                <div className="mt-6 sm:flex sm:flex-row-reverse">
                  <button
                  type="submit"
                  disabled={isSubmitting || !currentOrg.name}
                  className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                  
                    {isSubmitting ? 'Saving...' : 'Save'}
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
        title="Delete Organization"
        message={`Are you sure you want to delete ${orgToDelete?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        isDanger={true}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setOrgToDelete(null);
        }} />
      
    </div>);

};
