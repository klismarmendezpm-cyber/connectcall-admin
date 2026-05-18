import React from 'react';
interface StatusBadgeProps {
  status: string;
  className?: string;
}
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = ''
}) => {
  const getStatusStyles = () => {
    const s = status?.toLowerCase();
    if (s === 'active' || s === 'true' || s === 'success') {
      return 'bg-brand-success/10 text-brand-success border-brand-success/20';
    }
    if (s === 'disabled' || s === 'false' || s === 'failed') {
      return 'bg-brand-danger/10 text-brand-danger border-brand-danger/20';
    }
    if (s === 'archived' || s === 'closed') {
      return 'bg-slate-100 text-slate-600 border-slate-200';
    }
    if (s === 'warning' || s === 'unread') {
      return 'bg-brand-warning/10 text-brand-warning border-brand-warning/20';
    }
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyles()} ${className}`}>
      
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>);

};