import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, Role } from '../../context/AuthContext';
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles
}) => {
  const { user, isLoading, hasPermission } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>);

  }
  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{
          from: location
        }}
        replace />);


  }
  if (allowedRoles && !hasPermission(allowedRoles)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Acceso denegado
        </h2>
        <p className="text-slate-500 max-w-md">
          No tienes permiso para ver esta pagina. Contacta al administrador si
          crees que esto es un error.
        </p>
      </div>);

  }
  return <>{children}</>;
};
