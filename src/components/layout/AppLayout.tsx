import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';
import { Toaster } from 'sonner';
export const AppLayout = () => {
  const { user, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>);

  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <div className="app-shell flex min-h-screen h-dvh bg-brand-background overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen &&
      <div
        className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
        onClick={() => setMobileMenuOpen(false)} />

      }

      {/* Mobile Sidebar Wrapper */}
      <div
        className={`mobile-sidebar fixed inset-y-0 left-0 z-50 h-full w-72 max-w-[85vw] transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-200 ease-in-out md:relative md:z-auto md:w-64 md:max-w-none md:translate-x-0`}>
        
        <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="app-main flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
          <div className="w-full max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>);

};
