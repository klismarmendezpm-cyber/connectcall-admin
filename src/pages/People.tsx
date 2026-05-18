import React, { useEffect, useState } from 'react';
import { Plus, Users, Edit2, UserX, UserCheck, Eye } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { DataTable, Column } from '../components/ui/DataTable';
import { SearchInput } from '../components/ui/SearchInput';
import { FilterSelect } from '../components/ui/FilterSelect';
import { StatusBadge } from '../components/ui/StatusBadge';
import { logAudit } from '../lib/auditLogger';
import { toast } from 'sonner';
interface Person {
  id: number;
  org_id: number;
  full_name: string;
  id_number: string;
  phone: string;
  address: string;
  role_label: string;
  is_active: boolean;
  created_at: string;
  orgs?: {
    name: string;
  };
  assigned_org_ids?: number[];
  assigned_org_names?: string[];
}
export const People = () => {
  const { user, hasPermission } = useAuth();
  const canEdit = hasPermission(['admin', 'manager']);
  const [people, setPeople] = useState<Person[]>([]);
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
  const [statusFilter, setStatusFilter] = useState('true');
  const [currentPage, setCurrentPage] = useState(1);
  const peoplePerPage = 6;
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPerson, setCurrentPerson] = useState<Partial<Person>>({
    is_active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch orgs for dropdown
      const { data: orgData } = await supabase.
      from('orgs').
      select('id:org_id, name').
      order('name');
      if (orgData) setOrgs(orgData);
      // Fetch people with org join
      const { data: peopleData, error } = await supabase.
      from('people').
      select(
        `
          id:person_id,
          org_id,
          full_name,
          id_number,
          phone,
          address,
          role_label,
          is_active,
          created_at,
          updated_at,
          orgs (name)
        `
      ).
      order('full_name');
      if (error) throw error;
      const { data: assignmentData, error: assignmentError } = await supabase.
      from('person_org_assignments').
      select('person_id, org_id, orgs(name)');
      if (assignmentError) {
        console.warn('Additional organization assignments are not available:', assignmentError.message);
      }
      const assignmentMap = new Map<
        number,
        {
          ids: number[];
          names: string[];
        }
      >();
      (assignmentData || []).forEach((assignment: any) => {
        const current =
        assignmentMap.get(assignment.person_id) || {
          ids: [],
          names: []
        };
        current.ids.push(Number(assignment.org_id));
        if (assignment.orgs?.name) current.names.push(assignment.orgs.name);
        assignmentMap.set(assignment.person_id, current);
      });
      setPeople(
        (peopleData || []).map((person: any) => {
          const assignments =
          assignmentMap.get(person.id) || {
            ids: [],
            names: []
          };
          return {
            ...person,
            is_active: person.is_active === true || person.is_active === 1,
            assigned_org_ids: assignments.ids,
            assigned_org_names: assignments.names
          };
        })
      );
    } catch (error) {
      console.error('Error fetching people:', error);
      toast.error('Failed to load people');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, orgFilter, statusFilter]);
  const saveOrgAssignments = async (personId: number, assignedOrgIds: number[]) => {
    const cleanOrgIds = Array.from(
      new Set(
        assignedOrgIds.
        map((orgId) => Number(orgId)).
        filter((orgId) => orgId && orgId !== Number(currentPerson.org_id))
      )
    );
    const { error: deleteError } = await supabase.
    from('person_org_assignments').
    delete().
    eq('person_id', personId);
    if (deleteError) {
      console.warn('Could not save additional organization assignments:', deleteError.message);
      toast.warning('Person saved, but additional organizations need the Supabase assignment table.');
      return;
    }
    if (cleanOrgIds.length === 0) return;
    const { error: insertError } = await supabase.
    from('person_org_assignments').
    insert(cleanOrgIds.map((orgId) => ({
      person_id: personId,
      org_id: orgId
    })));
    if (insertError) {
      console.warn('Could not save additional organization assignments:', insertError.message);
      toast.warning('Person saved, but additional organizations were not saved.');
    }
  };
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPerson.full_name || !currentPerson.org_id) return;
    setIsSubmitting(true);
    try {
      const isNew = !currentPerson.id;
      const personData = {
        org_id: currentPerson.org_id,
        full_name: currentPerson.full_name,
        id_number: currentPerson.id_number || null,
        phone: currentPerson.phone || null,
        address: currentPerson.address || null,
        role_label: currentPerson.role_label || null,
        is_active:
        currentPerson.is_active !== undefined ?
        currentPerson.is_active ? 1 : 0 :
        1,
        updated_at: new Date().toISOString()
      };
      let savedPerson;
      if (isNew) {
        const { data, error } = await supabase.
        from('people').
        insert([
        {
          ...personData,
          created_at: new Date().toISOString()
        }]
        ).
        select('id:person_id, org_id, full_name, id_number, phone, address, role_label, is_active, created_at, updated_at, orgs(name)').
        single();
        if (error) throw error;
        savedPerson = data;
        await saveOrgAssignments(savedPerson.id, currentPerson.assigned_org_ids || []);
        toast.success('Person created successfully');
      } else {
        const { data, error } = await supabase.
        from('people').
        update(personData).
        eq('person_id', currentPerson.id).
        select('id:person_id, org_id, full_name, id_number, phone, address, role_label, is_active, created_at, updated_at, orgs(name)').
        single();
        if (error) throw error;
        savedPerson = data;
        await saveOrgAssignments(savedPerson.id, currentPerson.assigned_org_ids || []);
        toast.success('Person updated successfully');
      }
      await logAudit({
        actor: user?.username || 'unknown',
        action: isNew ? 'create' : 'update',
        entity: 'people',
        entity_id: savedPerson?.id || currentPerson.id,
        metadata: {
          name: personData.full_name
        }
      });
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving person:', error);
      toast.error('Failed to save person');
      // Prototype fallback
      const orgName =
      orgs.find((o) => o.id === Number(currentPerson.org_id))?.name ||
      'Unknown';
      if (!currentPerson.id) {
        setPeople([
        ...people,
        {
          ...currentPerson,
          id: Date.now(),
          created_at: new Date().toISOString(),
          orgs: {
            name: orgName
          }
        } as Person]
        );
      } else {
        setPeople(
          people.map((p) =>
          p.id === currentPerson.id ?
          {
            ...p,
            ...currentPerson,
            orgs: {
              name: orgName
            }
          } as Person :
          p
          )
        );
      }
      setIsModalOpen(false);
      toast.success('Person saved (Prototype mode)');
    } finally {
      setIsSubmitting(false);
    }
  };
  const toggleStatus = async (person: Person) => {
    try {
      const newStatus = !person.is_active;
      const { error } = await supabase.
      from('people').
      update({
        is_active: newStatus ? 1 : 0,
        updated_at: new Date().toISOString()
      }).
      eq('person_id', person.id);
      if (error) throw error;
      await logAudit({
        actor: user?.username || 'unknown',
        action: 'update',
        entity: 'people',
        entity_id: person.id,
        metadata: {
          action: newStatus ? 'enabled' : 'disabled'
        }
      });
      toast.success(`Person ${newStatus ? 'enabled' : 'disabled'} successfully`);
      fetchData();
    } catch (error) {
      console.error('Error toggling status:', error);
      // Prototype fallback
      setPeople(
        people.map((p) =>
        p.id === person.id ?
        {
          ...p,
          is_active: !p.is_active
        } :
        p
        )
      );
      toast.success(`Status updated (Prototype mode)`);
    }
  };
  const filteredPeople = people.filter((person) => {
    const matchesSearch =
    person.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    person.phone &&
    person.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
    person.role_label &&
    person.role_label.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesOrg = orgFilter ?
      person.org_id.toString() === orgFilter ||
      (person.assigned_org_ids || []).some((orgId) => orgId.toString() === orgFilter) :
      true;
    const matchesStatus = statusFilter ?
    person.is_active.toString() === statusFilter :
    true;
    return matchesSearch && matchesOrg && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredPeople.length / peoplePerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * peoplePerPage;
  const paginatedPeople = filteredPeople.slice(
    pageStart,
    pageStart + peoplePerPage
  );
  const columns: Column<Person>[] = [
  {
    header: 'Name',
    accessor: (row) =>
    <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium mr-3">
            {row.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-slate-900">{row.full_name}</div>
            {row.id_number &&
        <div className="text-xs text-slate-500">{row.id_number}</div>
        }
          </div>
        </div>,

    sortable: true,
    sortKey: 'full_name'
  },
  {
    header: 'Organization',
    accessor: (row) =>
    <div>
        <div className="font-medium text-slate-900">
          {row.orgs?.name || 'Unknown'}
        </div>
        {(row.assigned_org_names || []).length > 0 &&
      <div className="mt-1 flex flex-wrap gap-1">
            {row.assigned_org_names?.map((orgName) =>
        <span
          key={orgName}
          className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {orgName}
              </span>
        )}
          </div>
      }
      </div>
  },
  {
    header: 'Role',
    accessor: (row) => row.role_label || '-'
  },
  {
    header: 'Contact',
    accessor: (row) => row.phone || '-'
  },
  {
    header: 'Status',
    accessor: (row) =>
    <StatusBadge status={row.is_active ? 'active' : 'disabled'} />

  }];

  if (canEdit) {
    columns.push({
      header: 'Actions',
      accessor: (row) =>
      <div className="flex items-center space-x-2">
          <button
          onClick={(e) => {
            e.stopPropagation();
            setCurrentPerson(row);
            setIsModalOpen(true);
          }}
          className="p-1 text-slate-400 hover:text-brand-primary transition-colors"
          title="Edit">
          
            <Edit2 className="w-4 h-4" />
          </button>
          <button
          onClick={(e) => {
            e.stopPropagation();
            toggleStatus(row);
          }}
          className={`p-1 transition-colors ${row.is_active ? 'text-slate-400 hover:text-brand-danger' : 'text-slate-400 hover:text-brand-success'}`}
          title={row.is_active ? 'Disable' : 'Enable'}>
          
            {row.is_active ?
          <UserX className="w-4 h-4" /> :

          <UserCheck className="w-4 h-4" />
          }
          </button>
        </div>,

      className: 'text-right'
    });
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">People</h2>
          <p className="text-slate-500 mt-1">
            Manage employees and contractors
          </p>
        </div>
        {canEdit &&
        <button
          onClick={() => {
            setCurrentPerson({
              is_active: true
            });
            setIsModalOpen(true);
          }}
          className="btn-primary flex items-center">
          
            <Plus className="w-4 h-4 mr-2" />
            Add Person
          </button>
        }
      </div>

      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name, phone, or role..." />
            
          </div>
          <div className="w-full md:w-48">
            <FilterSelect
              value={orgFilter}
              onChange={setOrgFilter}
              options={orgs.map((o) => ({
                label: o.name,
                value: o.id.toString()
              }))}
              placeholder="All Organizations" />
            
          </div>
          <div className="w-full md:w-40">
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
              {
                label: 'Active',
                value: 'true'
              },
              {
                label: 'Disabled',
                value: 'false'
              }]
              }
              placeholder="All Statuses" />
            
          </div>
        </div>

        <DataTable
          columns={columns}
          data={paginatedPeople}
          isLoading={isLoading}
          emptyMessage="No people found matching your filters." />

        {filteredPeople.length > 0 &&
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 text-sm">
            <div className="text-slate-500">
              Showing {pageStart + 1}-
              {Math.min(pageStart + peoplePerPage, filteredPeople.length)} of{' '}
              {filteredPeople.length} people
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
                {currentPerson.id ? 'Edit Person' : 'Add Person'}
              </h3>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                    type="text"
                    required
                    value={currentPerson.full_name || ''}
                    onChange={(e) =>
                    setCurrentPerson({
                      ...currentPerson,
                      full_name: e.target.value
                    })
                    }
                    className="input-field mt-1" />
                  
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Organization <span className="text-red-500">*</span>
                    </label>
                    <select
                    required
                    value={currentPerson.org_id || ''}
                    onChange={(e) =>
                    setCurrentPerson({
                      ...currentPerson,
                      org_id: Number(e.target.value),
                      assigned_org_ids: (currentPerson.assigned_org_ids || []).
                      filter((orgId) => orgId !== Number(e.target.value))
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
                      Additional Organizations
                    </label>
                    <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                      {orgs.
                    filter((org) => org.id !== Number(currentPerson.org_id)).
                    map((org) =>
                    <label
                      key={org.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                            <input
                        type="checkbox"
                        checked={(currentPerson.assigned_org_ids || []).includes(org.id)}
                        onChange={(e) => {
                          const currentIds = currentPerson.assigned_org_ids || [];
                          setCurrentPerson({
                            ...currentPerson,
                            assigned_org_ids: e.target.checked ?
                            [...currentIds, org.id] :
                            currentIds.filter((orgId) => orgId !== org.id)
                          });
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                            {org.name}
                          </label>
                    )}
                      {orgs.length <= 1 &&
                    <p className="px-2 py-1.5 text-sm text-slate-500">
                          No other organizations available.
                        </p>
                    }
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      ID Number
                    </label>
                    <input
                    type="text"
                    value={currentPerson.id_number || ''}
                    onChange={(e) =>
                    setCurrentPerson({
                      ...currentPerson,
                      id_number: e.target.value
                    })
                    }
                    className="input-field mt-1" />
                  
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Role / Title
                    </label>
                    <input
                    type="text"
                    value={currentPerson.role_label || ''}
                    onChange={(e) =>
                    setCurrentPerson({
                      ...currentPerson,
                      role_label: e.target.value
                    })
                    }
                    className="input-field mt-1" />
                  
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Phone Number
                    </label>
                    <input
                    type="text"
                    value={currentPerson.phone || ''}
                    onChange={(e) =>
                    setCurrentPerson({
                      ...currentPerson,
                      phone: e.target.value
                    })
                    }
                    className="input-field mt-1" />
                  
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Address
                    </label>
                    <input
                    type="text"
                    value={currentPerson.address || ''}
                    onChange={(e) =>
                    setCurrentPerson({
                      ...currentPerson,
                      address: e.target.value
                    })
                    }
                    className="input-field mt-1" />
                  
                  </div>

                  <div className="md:col-span-2 flex items-center mt-2">
                    <input
                    id="is_active"
                    type="checkbox"
                    checked={currentPerson.is_active}
                    onChange={(e) =>
                    setCurrentPerson({
                      ...currentPerson,
                      is_active: e.target.checked
                    })
                    }
                    className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded" />
                  
                    <label
                    htmlFor="is_active"
                    className="ml-2 block text-sm text-slate-700">
                    
                      Active Account
                    </label>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 sm:flex sm:flex-row-reverse">
                  <button
                  type="submit"
                  disabled={
                  isSubmitting ||
                  !currentPerson.full_name ||
                  !currentPerson.org_id
                  }
                  className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                  
                    {isSubmitting ? 'Saving...' : 'Save Person'}
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
    </div>);

};
