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
    <div className="flex h-screen bg-brand-background overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen &&
      <div
        className="fixed inset-0 bg-slate-900/50 z-20 md:hidden"
        onClick={() => setMobileMenuOpen(false)} />

      }

      {/* Mobile Sidebar Wrapper */}
      <div
        className={`fixed inset-y-0 left-0 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-200 ease-in-out z-30 md:z-auto`}>
        
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>);

};