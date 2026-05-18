import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User as UserIcon, ChevronDown, Menu } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getProfilePhoto } from '../../lib/profilePhoto';
interface HeaderProps {
  onMenuClick: () => void;
}
export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node))
      {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  useEffect(() => {
    setProfilePhoto(getProfilePhoto(user?.id));
    const handlePhotoChange = () => setProfilePhoto(getProfilePhoto(user?.id));
    window.addEventListener('vault_profile_photo_changed', handlePhotoChange);
    return () =>
    window.removeEventListener('vault_profile_photo_changed', handlePhotoChange);
  }, [user?.id]);
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-10">
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 mr-2 text-slate-500 hover:bg-slate-100 rounded-lg">
          
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-slate-800 hidden sm:block">
          Credentials Management
        </h1>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-3 p-1.5 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
            
            <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-semibold">
              {profilePhoto ?
              <img
                src={profilePhoto}
                alt="Profile"
                className="w-full h-full rounded-full object-cover" /> :
              user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-slate-700 leading-none mb-1">
                {user?.full_name}
              </div>
              <div className="text-xs text-slate-500 leading-none capitalize">
                {user?.role_name}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {isDropdownOpen &&
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {user?.full_name}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                {user?.last_login_at &&
              <p className="text-[10px] text-slate-400 mt-1">
                    Last login:{' '}
                    {formatDistanceToNow(new Date(user.last_login_at), {
                  addSuffix: true
                })}
                  </p>
              }
              </div>

              <div className="py-1">
                <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate('/profile');
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center">
                
                  <UserIcon className="w-4 h-4 mr-2 text-slate-400" />
                  Profile
                </button>
                <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  logout();
                }}
                className="w-full text-left px-4 py-2 text-sm text-brand-danger hover:bg-red-50 flex items-center">
                
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </header>);

};
