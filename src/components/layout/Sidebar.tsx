import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Server,
  KeyRound,
  Inbox,
  ShieldAlert,
  History,
  Settings,
  Shield,
  PanelLeftClose,
  PanelLeftOpen } from
'lucide-react';
import { useAuth } from '../../context/AuthContext';
interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}
export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggle,
  onNavigate
}) => {
  const { user } = useAuth();
  const navItems = [
  {
    path: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'readonly']
  },
  {
    path: '/organizations',
    label: 'Organizations',
    icon: Building2,
    roles: ['admin', 'manager', 'readonly']
  },
  {
    path: '/people',
    label: 'People',
    icon: Users,
    roles: ['admin', 'manager', 'readonly']
  },
  {
    path: '/systems',
    label: 'Systems',
    icon: Server,
    roles: ['admin', 'manager']
  },
  {
    path: '/accounts',
    label: 'Accounts',
    icon: KeyRound,
    roles: ['admin', 'manager', 'readonly']
  },
  {
    path: '/inbox',
    label: 'Inbox Messages',
    icon: Inbox,
    roles: ['admin', 'manager', 'readonly']
  },
  {
    path: '/users',
    label: 'Users & Roles',
    icon: Shield,
    roles: ['admin', 'manager']
  },
  {
    path: '/audit-log',
    label: 'Audit Log',
    icon: History,
    roles: ['admin', 'manager']
  },
  {
    path: '/login-attempts',
    label: 'Login Attempts',
    icon: ShieldAlert,
    roles: ['admin', 'manager']
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['admin', 'manager']
  }];

  const filteredNav = navItems.filter(
    (item) => user && item.roles.includes(user.role_name)
  );
  return (
    <aside className="w-full bg-brand-primary text-white flex flex-col h-full flex-shrink-0 shadow-2xl md:shadow-none">
      <div className={`h-16 flex items-center border-b border-white/10 justify-between px-4 ${collapsed ? 'md:justify-center md:px-3' : ''}`}>
        <div className={`flex items-center min-w-0 ${collapsed ? 'md:justify-center' : ''}`}>
          <KeyRound className={`w-6 h-6 text-brand-accent flex-shrink-0 mr-3 ${collapsed ? 'md:mr-0' : ''}`} />
          <span className={`font-bold text-lg tracking-tight whitespace-nowrap overflow-hidden transition-[opacity,width] duration-200 ${collapsed ? 'md:w-0 md:opacity-0' : 'w-auto opacity-100'}`}>
          Vault<span className="text-brand-accent">Sys</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="hidden md:flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ?
          <PanelLeftOpen className="w-5 h-5" /> :
          <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
              `flex items-center rounded-lg transition-colors group px-3 py-2.5 ${collapsed ? 'md:justify-center md:px-0 md:py-3' : ''} ${isActive ? 'bg-white/10 text-white font-medium' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`
              }>
              
              <Icon className={`w-5 h-5 flex-shrink-0 mr-3 ${collapsed ? 'md:mr-0' : ''}`} />
              <span className={`truncate transition-[opacity,width] duration-200 ${collapsed ? 'md:w-0 md:opacity-0' : 'w-auto opacity-100'}`}>
                {item.label}
              </span>
            </NavLink>);

        })}
      </div>

      <div className={`p-4 border-t border-white/10 ${collapsed ? 'md:p-3' : ''}`}>
        <div className={`bg-white/5 rounded-lg p-3 ${collapsed ? 'md:flex md:justify-center' : ''}`}>
          <div className={`text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1 ${collapsed ? 'md:sr-only' : ''}`}>
            Current Role
          </div>
          <div
            className={`flex items-center ${collapsed ? 'md:justify-center' : ''}`}
            title={collapsed ? `Current Role: ${user?.role_name}` : undefined}>
            <Shield className={`w-4 h-4 text-brand-accent mr-2 ${collapsed ? 'md:mr-0' : ''}`} />
            <span className={`text-sm font-medium capitalize truncate transition-[opacity,width] duration-200 ${collapsed ? 'md:w-0 md:opacity-0' : 'w-auto opacity-100'}`}>
              {user?.role_name}
            </span>
          </div>
        </div>
      </div>
    </aside>);

};
