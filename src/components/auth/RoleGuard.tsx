import React from 'react';
import { useAuth, Role } from '../../context/AuthContext';
interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Role[];
  fallback?: React.ReactNode;
}
export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  fallback = null
}) => {
  const { hasPermission } = useAuth();
  if (!hasPermission(allowedRoles)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};