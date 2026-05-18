import React, { useEffect, useState } from 'react';
import { User, Mail, Shield, Clock, Save, Upload, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logAudit } from '../lib/auditLogger';
import {
  getProfilePhoto,
  prepareProfilePhoto,
  removeProfilePhoto,
  saveProfilePhoto
} from '../lib/profilePhoto';

export const Profile = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFullName(user?.full_name || '');
    setEmail(user?.email || '');
    setProfilePhoto(getProfilePhoto(user?.id));
  }, [user]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    try {
      const photoDataUrl = await prepareProfilePhoto(file);
      saveProfilePhoto(user.id, photoDataUrl);
      setProfilePhoto(photoDataUrl);
      toast.success('Profile photo updated');
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      toast.error('Could not process profile photo');
    } finally {
      event.target.value = '';
    }
  };

  const handleRemovePhoto = () => {
    if (!user) return;
    removeProfilePhoto(user.id);
    setProfilePhoto('');
    toast.success('Profile photo removed');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !fullName || !email) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.
      from('auth_users').
      update({
        full_name: fullName,
        updated_at: new Date().toISOString()
      }).
      eq('user_id', user.id);

      if (error) throw error;

      const nextUser = {
        ...user,
        full_name: fullName,
        email: user.email
      };
      localStorage.setItem('vault_user', JSON.stringify(nextUser));

      await logAudit({
        actor: user.username,
        action: 'update',
        entity: 'auth_users',
        entity_id: user.id,
        metadata: {
          action: 'profile_update'
        }
      });

      toast.success('Profile updated');
      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center">
          <User className="w-6 h-6 mr-2 text-brand-primary" />
          Profile
        </h2>
        <p className="text-slate-500 mt-1">
          Manage your account identity and session details
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary text-3xl font-semibold overflow-hidden border border-slate-200">
              {profilePhoto ?
              <img
                src={profilePhoto}
                alt="Profile"
                className="w-full h-full object-cover" /> :
              user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <label className="btn-secondary text-sm px-3 py-1.5 flex items-center cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Upload
                <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden" />
              </label>
              {profilePhoto &&
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="btn-secondary text-sm px-3 py-1.5 flex items-center">
                <X className="w-4 h-4 mr-2" />
                Remove
              </button>
              }
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              {user?.full_name}
            </h3>
            <p className="text-sm text-slate-500">{user?.username}</p>
            <span className="mt-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-blue-100 text-blue-800">
              <Shield className="w-3 h-3 mr-1" />
              {user?.role_name}
            </span>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 space-y-3 text-sm">
            <div className="flex items-center text-slate-600">
              <Mail className="w-4 h-4 mr-2 text-slate-400" />
              <span className="truncate">{user?.email}</span>
            </div>
            {user?.last_login_at &&
            <div className="flex items-center text-slate-600">
                <Clock className="w-4 h-4 mr-2 text-slate-400" />
                <span>
                  Last login{' '}
                  {formatDistanceToNow(new Date(user.last_login_at), {
                    addSuffix: true
                  })}
                </span>
              </div>
            }
          </div>
        </div>

        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-3">
            Account Details
          </h3>

          <form onSubmit={handleSave} className="mt-6 space-y-4 max-w-xl">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field mt-1" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
              type="email"
              required
              value={email}
              disabled
              className="input-field mt-1" />
              <p className="text-xs text-slate-500 mt-1">
                Email is managed by Supabase Auth.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Username
              </label>
              <input
              type="text"
              value={user?.username || ''}
              disabled
              className="input-field mt-1" />
            </div>

            <div className="pt-4 flex justify-end">
              <button
              type="submit"
              disabled={isSaving || !fullName || !email}
              className="btn-primary flex items-center">
                {isSaving ? 'Saving...' : <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Profile
                  </>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
