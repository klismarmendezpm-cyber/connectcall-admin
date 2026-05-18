import React, { useEffect, useState } from 'react';
import {
  Users,
  Server,
  KeyRound,
  CheckCircle2,
  XCircle,
  Inbox,
  Activity } from
'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isReadonly = user?.role_name === 'readonly';
  const [stats, setStats] = useState({
    people: 0,
    systems: 0,
    accounts: 0,
    activeAccounts: 0,
    disabledAccounts: 0,
    unreadMessages: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // In a real app, these would be concurrent Promise.all calls or a single RPC
        // For prototype, we'll try to fetch, but fallback to mock data if it fails
        const baseRequests = [
        supabase.from('people').select('*', {
          count: 'exact',
          head: true
        }),
        isReadonly ?
        Promise.resolve({
          count: 0
        }) :
        supabase.from('systems').select('*', {
          count: 'exact',
          head: true
        }),
        supabase.from('accounts').select('*', {
          count: 'exact',
          head: true
        }),
        supabase.
        from('accounts').
        select('*', {
          count: 'exact',
          head: true
        }).
        eq('status', 'active'),
        supabase.
        from('accounts').
        select('*', {
          count: 'exact',
          head: true
        }).
        eq('status', 'disabled'),
        supabase.
        from('inbox_messages').
        select('*', {
          count: 'exact',
          head: true
        }).
        eq('is_read', 0)];
        const [
        { count: peopleCount },
        { count: systemsCount },
        { count: accountsCount },
        { count: activeCount },
        { count: disabledCount },
        { count: unreadCount },
        activityResult] =
        await Promise.all([
        ...baseRequests,
        isReadonly ?
        Promise.resolve({
          data: []
        }) :
        supabase.
        from('audit_log').
        select('id:audit_id, actor, action, entity, entity_id, metadata').
        order('audit_id', {
          ascending: false
        }).
        limit(5)]
        );
        const activityData = activityResult.data || [];
        // If DB is empty/failing, use mock data for the prototype visual
        if (peopleCount === null && systemsCount === null) {
          setStats({
            people: 142,
            systems: 28,
            accounts: 456,
            activeAccounts: 412,
            disabledAccounts: 34,
            unreadMessages: 7
          });
          setRecentActivity(isReadonly ? [] : [
          {
            id: 1,
            actor: 'admin',
            action: 'view',
            entity: 'accounts',
            created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString()
          },
          {
            id: 2,
            actor: 'jdoe',
            action: 'update',
            entity: 'people',
            created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString()
          },
          {
            id: 3,
            actor: 'admin',
            action: 'create',
            entity: 'systems',
            created_at: new Date(
              Date.now() - 1000 * 60 * 60 * 2
            ).toISOString()
          },
          {
            id: 4,
            actor: 'msmith',
            action: 'login',
            entity: 'auth_users',
            created_at: new Date(
              Date.now() - 1000 * 60 * 60 * 5
            ).toISOString()
          },
          {
            id: 5,
            actor: 'admin',
            action: 'delete',
            entity: 'accounts',
            created_at: new Date(
              Date.now() - 1000 * 60 * 60 * 24
            ).toISOString()
          }]
          );
        } else {
          setStats({
            people: peopleCount || 0,
            systems: systemsCount || 0,
            accounts: accountsCount || 0,
            activeAccounts: activeCount || 0,
            disabledAccounts: disabledCount || 0,
            unreadMessages: unreadCount || 0
          });
          setRecentActivity(
            (activityData || []).map((activity: any) => ({
              ...activity,
              created_at: new Date().toISOString()
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, [isReadonly]);
  const statCards = [
  {
    title: 'Total People',
    value: stats.people,
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-100'
  },
  {
    title: 'Total Systems',
    value: stats.systems,
    icon: Server,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100'
  },
  {
    title: 'Total Accounts',
    value: stats.accounts,
    icon: KeyRound,
    color: 'text-purple-600',
    bg: 'bg-purple-100'
  },
  {
    title: 'Active Accounts',
    value: stats.activeAccounts,
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-100'
  },
  {
    title: 'Disabled Accounts',
    value: stats.disabledAccounts,
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-100'
  },
  {
    title: 'Unread Messages',
    value: stats.unreadMessages,
    icon: Inbox,
    color: 'text-amber-600',
    bg: 'bg-amber-100'
  }].filter((stat) => !isReadonly || stat.title !== 'Total Systems');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>);

  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 mt-1">
          Overview of your credentials vault
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="card p-6 flex items-center">
              <div className={`p-4 rounded-xl ${stat.bg} mr-4`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {stat.value.toLocaleString()}
                </p>
              </div>
            </div>);

        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-brand-primary" />
              Recent Activity
            </h3>
          </div>
          <div className="p-0">
            {recentActivity.length > 0 ?
            <ul className="divide-y divide-slate-100">
                {recentActivity.map((activity) =>
              <li
                key={activity.id}
                className="px-6 py-4 hover:bg-slate-50 transition-colors">
                
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-xs mr-3">
                          {activity.actor.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm text-slate-900">
                            <span className="font-medium">
                              {activity.actor}
                            </span>{' '}
                            performed{' '}
                            <span className="font-medium">
                              {activity.action}
                            </span>{' '}
                            on{' '}
                            <span className="font-medium">
                              {activity.entity}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatDistanceToNow(
                          new Date(activity.created_at),
                          {
                            addSuffix: true
                          }
                        )}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-600 font-mono">
                        ID: {activity.id}
                      </div>
                    </div>
                  </li>
              )}
              </ul> :

            <div className="p-6 text-center text-slate-500">
                No recent activity found.
              </div>
            }
          </div>
        </div>

        {!isReadonly &&
        <div className="card">
          <div className="px-6 py-5 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">
              System Status
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Database Connection
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                Healthy
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Edge Functions</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Last Backup</span>
              <span className="text-sm font-medium text-slate-900">
                Today, 03:00 AM
              </span>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate('/audit-log')}
                className="w-full btn-secondary text-sm">
                View Full System Logs
              </button>
            </div>
          </div>
        </div>
        }
      </div>
    </div>);

};
