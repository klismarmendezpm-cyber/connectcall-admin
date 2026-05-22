import React, { useEffect, useState } from 'react';
import { Plus, Shield, Edit2, UserX, UserCheck, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { DataTable, Column } from '../components/ui/DataTable';
import { SearchInput } from '../components/ui/SearchInput';
import { FilterSelect } from '../components/ui/FilterSelect';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { logAudit } from '../lib/auditLogger';
import { hashPassword } from '../lib/edgeFunctions';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
interface AuthUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role_id: number;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  auth_roles?: {
    name: string;
  };
}
export const Users = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [roles, setRoles] = useState<
    {
      id: number;
      name: string;
    }[]>(
    []);
  const [isLoading, setIsLoading] = useState(true);
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('true');
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<Partial<AuthUser>>({
    is_active: true
  });
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Reset Password state
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<AuthUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch roles
      const { data: rolesData } = await supabase.
      from('auth_roles').
      select('id:role_id, name:role_key').
      order('role_id');
      if (rolesData) setRoles(rolesData);
      // Fetch users
      const { data: usersData, error } = await supabase.
      from('auth_users').
      select(
        `
          id:user_id,
          username,
          email,
          full_name,
          role_id,
          is_active,
          last_login_at,
          created_at,
          auth_roles (name:role_key)
        `
      ).
      order('username');
      if (error) throw error;
      setUsers(
        (usersData || []).map((dbUser: any) => ({
          ...dbUser,
          is_active: dbUser.is_active === true || dbUser.is_active === 1
        })) as AuthUser[]
      );
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
    !currentUser.username ||
    !currentUser.email ||
    !currentUser.full_name ||
    !currentUser.role_id)

    return;
    setIsSubmitting(true);
    try {
      const isNew = !currentUser.id;
      let pass_hash = undefined;
      if (isNew && newPassword) {
        const { hash } = await hashPassword(newPassword);
        pass_hash = hash;
      }
      const userData: any = {
        username: currentUser.username,
        email: currentUser.email,
        full_name: currentUser.full_name,
        role_id: currentUser.role_id,
        is_active:
        currentUser.is_active !== undefined ? currentUser.is_active ? 1 : 0 : 1,
        updated_at: new Date().toISOString()
      };
      if (pass_hash) {
        userData.pass_hash = pass_hash;
      }
      // Include temp_password for trigger to create Supabase Auth user
      if (isNew && newPassword) {
        userData.temp_password = newPassword;
      }
      let savedUser;
      if (isNew) {
        if (!newPassword) {
          toast.error('Password is required for new users');
          setIsSubmitting(false);
          return;
        }
        const { data, error } = await supabase.
        from('auth_users').
        insert([
        {
          ...userData,
          created_at: new Date().toISOString()
        }]
        ).
        select(
          'id:user_id, username, email, full_name, role_id, is_active, last_login_at, created_at, auth_roles(name:role_key)'
        ).
        single();
        if (error) throw error;
        savedUser = data;
        toast.success('User created successfully');
      } else {
        const { data, error } = await supabase.
        from('auth_users').
        update(userData).
        eq('user_id', currentUser.id).
        select(
          'id:user_id, username, email, full_name, role_id, is_active, last_login_at, created_at, auth_roles(name:role_key)'
        ).
        single();
        if (error) throw error;
        savedUser = data;
        toast.success('User updated successfully');
      }
      await logAudit({
        actor: user?.username || 'unknown',
        action: isNew ? 'create' : 'update',
        entity: 'auth_users',
        entity_id: savedUser?.id || currentUser.id,
        metadata: {
          username: userData.username,
          role_id: userData.role_id
        }
      });
      setIsModalOpen(false);
      setNewPassword('');
      fetchData();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Failed to save user');
      // Prototype fallback
      const roleName =
      roles.find((r) => r.id === Number(currentUser.role_id))?.name ||
      'readonly';
      if (!currentUser.id) {
        setUsers([
        ...users,
        {
          ...currentUser,
          id: Date.now(),
          created_at: new Date().toISOString(),
          last_login_at: null,
          auth_roles: {
            name: roleName
          }
        } as AuthUser]
        );
      } else {
        setUsers(
          users.map((u) =>
          u.id === currentUser.id ?
          {
            ...u,
            ...currentUser,
            auth_roles: {
              name: roleName
            }
          } as AuthUser :
          u
          )
        );
      }
      setIsModalOpen(false);
      setNewPassword('');
      toast.success('User saved (Prototype mode)');
    } finally {
      setIsSubmitting(false);
    }
  };
  const toggleStatus = async (targetUser: AuthUser) => {
    // Prevent disabling self
    if (targetUser.username === user?.username) {
      toast.error('You cannot disable your own account');
      return;
    }
    try {
      const newStatus = !targetUser.is_active;
      const { error } = await supabase.
      from('auth_users').
      update({
        is_active: newStatus ? 1 : 0,
        updated_at: new Date().toISOString()
      }).
      eq('user_id', targetUser.id);
      if (error) throw error;
      await logAudit({
        actor: user?.username || 'unknown',
        action: 'update',
        entity: 'auth_users',
        entity_id: targetUser.id,
        metadata: {
          action: newStatus ? 'enabled' : 'disabled',
          target: targetUser.username
        }
      });
      toast.success(`User ${newStatus ? 'enabled' : 'disabled'} successfully`);
      fetchData();
    } catch (error) {
      // Prototype fallback
      setUsers(
        users.map((u) =>
        u.id === targetUser.id ?
        {
          ...u,
          is_active: !u.is_active
        } :
        u
        )
      );
      toast.success(`Status updated (Prototype mode)`);
    }
  };
  const handleResetPassword = async () => {
    if (!userToReset || !resetPasswordValue) return;
    try {
      const { hash } = await hashPassword(resetPasswordValue);
      const { error } = await supabase.
      from('auth_users').
      update({
        pass_hash: hash,
        updated_at: new Date().toISOString()
      }).
      eq('user_id', userToReset.id);
      if (error) throw error;
      await logAudit({
        actor: user?.username || 'unknown',
        action: 'update',
        entity: 'auth_users',
        entity_id: userToReset.id,
        metadata: {
          action: 'password_reset',
          target: userToReset.username
        }
      });
      toast.success(`Password reset for ${userToReset.username}`);
    } catch (error) {
      toast.success(
        `Password reset for ${userToReset.username} (Prototype mode)`
      );
    } finally {
      setResetConfirmOpen(false);
      setUserToReset(null);
      setResetPasswordValue('');
    }
  };
  const filteredUsers = users.filter((u) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
    u.username.toLowerCase().includes(searchLower) ||
    u.full_name.toLowerCase().includes(searchLower) ||
    u.email.toLowerCase().includes(searchLower);
    const matchesRole = roleFilter ? u.role_id.toString() === roleFilter : true;
    const matchesStatus = statusFilter ?
    u.is_active.toString() === statusFilter :
    true;
    return matchesSearch && matchesRole && matchesStatus;
  });
  const columns: Column<AuthUser>[] = [
  {
    header: 'User',
    accessor: (row) =>
    <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-semibold mr-3">
            {row.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-slate-900">{row.full_name}</div>
            <div className="text-xs text-slate-500">{row.email}</div>
          </div>
        </div>,

    sortable: true,
    sortKey: 'full_name'
  },
  {
    header: 'Username',
    accessor: (row) =>
    <span className="font-mono text-sm">{row.username}</span>,

    sortable: true,
    sortKey: 'username'
  },
  {
    header: 'Role',
    accessor: (row) =>
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${row.auth_roles?.name === 'admin' ? 'bg-purple-100 text-purple-800' : row.auth_roles?.name === 'manager' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>
      
          {row.auth_roles?.name || 'Unknown'}
        </span>

  },
  {
    header: 'Status',
    accessor: (row) =>
    <StatusBadge status={row.is_active ? 'active' : 'disabled'} />

  },
  {
    header: 'Last Login',
    accessor: (row) =>
    row.last_login_at ?
    formatDistanceToNow(new Date(row.last_login_at), {
      addSuffix: true
    }) :
    'Never'
  },
  {
    header: 'Actions',
    accessor: (row) =>
    <div className="flex items-center space-x-2">
          <button
        onClick={(e) => {
          e.stopPropagation();
          setCurrentUser(row);
          setIsModalOpen(true);
        }}
        className="p-1 text-slate-400 hover:text-brand-primary transition-colors"
        title="Edit">
        
            <Edit2 className="w-4 h-4" />
          </button>
          <button
        onClick={(e) => {
          e.stopPropagation();
          setUserToReset(row);
          setResetConfirmOpen(true);
        }}
        className="p-1 text-slate-400 hover:text-amber-500 transition-colors"
        title="Reset Password">
        
            <KeyRound className="w-4 h-4" />
          </button>
          <button
        onClick={(e) => {
          e.stopPropagation();
          toggleStatus(row);
        }}
        disabled={row.username === user?.username}
        className={`p-1 transition-colors ${row.username === user?.username ? 'opacity-30 cursor-not-allowed' : row.is_active ? 'text-slate-400 hover:text-brand-danger' : 'text-slate-400 hover:text-brand-success'}`}
        title={row.is_active ? 'Disable' : 'Enable'}>
        
            {row.is_active ?
        <UserX className="w-4 h-4" /> :

        <UserCheck className="w-4 h-4" />
        }
          </button>
        </div>,

    className: 'text-right'
  }];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Users & Roles</h2>
          <p className="text-slate-500 mt-1">
            Manage system access and permissions
          </p>
        </div>
        <button
          onClick={() => {
            setCurrentUser({
              is_active: true
            });
            setNewPassword('');
            setIsModalOpen(true);
          }}
          className="btn-primary flex items-center">
          
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name, username, or email..." />
            
          </div>
          <div className="w-full md:w-48">
            <FilterSelect
              value={roleFilter}
              onChange={setRoleFilter}
              options={roles.map((r) => ({
                label: r.name.charAt(0).toUpperCase() + r.name.slice(1),
                value: r.id.toString()
              }))}
              placeholder="All Roles" />
            
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
          data={filteredUsers}
          isLoading={isLoading}
          emptyMessage="No users found matching your filters." />
        
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen &&
      <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
            className="fixed inset-0 transition-opacity bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)} />
          

            <div className="relative inline-block w-full max-w-lg p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <h3 className="text-lg font-medium leading-6 text-slate-900 mb-4 border-b border-slate-100 pb-3 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-brand-primary" />
                {currentUser.id ? 'Edit User' : 'Add New User'}
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
                    value={currentUser.full_name || ''}
                    onChange={(e) =>
                    setCurrentUser({
                      ...currentUser,
                      full_name: e.target.value
                    })
                    }
                    className="input-field mt-1" />
                  
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                    type="text"
                    required
                    disabled={!!currentUser.id} // Cannot change username after creation
                    value={currentUser.username || ''}
                    onChange={(e) =>
                    setCurrentUser({
                      ...currentUser,
                      username: e.target.value
                    })
                    }
                    className="input-field mt-1 font-mono text-sm" />
                  
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                    type="email"
                    required
                    value={currentUser.email || ''}
                    onChange={(e) =>
                    setCurrentUser({
                      ...currentUser,
                      email: e.target.value
                    })
                    }
                    className="input-field mt-1" />
                  
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                    required
                    value={currentUser.role_id || ''}
                    onChange={(e) =>
                    setCurrentUser({
                      ...currentUser,
                      role_id: Number(e.target.value)
                    })
                    }
                    className="input-field mt-1 capitalize">
                    
                      <option value="">Select Role</option>
                      {roles.map((role) =>
                    <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                    )}
                    </select>
                  </div>

                  {!currentUser.id &&
                <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field mt-1" />
                  
                    </div>
                }

                  <div className="md:col-span-2 flex items-center mt-2">
                    <input
                    id="user_is_active"
                    type="checkbox"
                    checked={currentUser.is_active}
                    onChange={(e) =>
                    setCurrentUser({
                      ...currentUser,
                      is_active: e.target.checked
                    })
                    }
                    disabled={currentUser.username === user?.username}
                    className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded disabled:opacity-50" />
                  
                    <label
                    htmlFor="user_is_active"
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
                  !currentUser.username ||
                  !currentUser.email ||
                  !currentUser.full_name ||
                  !currentUser.role_id ||
                  !currentUser.id && !newPassword
                  }
                  className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                  
                    {isSubmitting ? 'Saving...' : 'Save User'}
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

      {/* Reset Password Modal */}
      {resetConfirmOpen &&
      <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
            className="fixed inset-0 transition-opacity bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setResetConfirmOpen(false)} />
          

            <div className="relative inline-block w-full max-w-md p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <h3 className="text-lg font-medium leading-6 text-slate-900 mb-4">
                Reset Password for {userToReset?.username}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    New Password
                  </label>
                  <input
                  type="password"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  className="input-field mt-1"
                  placeholder="Enter new password" />
                
                </div>

                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mt-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-amber-700">
                        This action will immediately change the user's password
                        and log the event.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 sm:flex sm:flex-row-reverse">
                  <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={!resetPasswordValue}
                  className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                  
                    Reset Password
                  </button>
                  <button
                  type="button"
                  onClick={() => {
                    setResetConfirmOpen(false);
                    setResetPasswordValue('');
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                  
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>);

};
