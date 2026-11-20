/**
 * SceneOS — Profile Modal
 * Allows updating display name, phone, bio, and avatar.
 * Prevents tampering with ownership or role fields through profile updates.
 */

import React, { useState, useEffect } from 'react';
import { User, Phone, FileText, Check, AlertCircle, X } from 'lucide-react';
import { services } from '../../services';
import { useProject } from '../projects/ProjectContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
];

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { currentUser } = useProject();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName || '');
      setPhone(currentUser.phone || '');
      setBio(currentUser.bio || '');
      setAvatarUrl(currentUser.avatarUrl || PRESET_AVATARS[0]);
    }
  }, [currentUser]);

  if (!isOpen || !currentUser) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!fullName.trim()) {
      setFeedback({ type: 'error', message: 'Full name cannot be empty.' });
      return;
    }

    setIsSaving(true);
    try {
      await services.auth.updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        avatarUrl: avatarUrl || null,
      });
      setFeedback({ type: 'success', message: 'Profile updated successfully.' });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-[#0B0E17] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-950/70 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Crew Profile</h2>
              <p className="text-xs text-slate-400">Manage your identity and call-sheet contact details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {feedback && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
            }`}>
              {feedback.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Avatar Picker */}
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-slate-400 block">Avatar</label>
            <div className="flex items-center gap-3">
              <img
                src={avatarUrl || PRESET_AVATARS[0]}
                alt="Avatar Preview"
                className="w-12 h-12 rounded-full object-cover border-2 border-cyan-500 shrink-0"
              />
              <div className="flex gap-2">
                {PRESET_AVATARS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`w-8 h-8 rounded-full overflow-hidden border-2 transition ${
                      avatarUrl === url ? 'border-cyan-400 scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Read-Only Account Email */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-400">Account Email (Verified)</label>
            <input
              type="text"
              disabled
              value={currentUser.email}
              className="w-full px-3 py-2 bg-slate-950/50 border border-slate-900 rounded-xl text-xs text-slate-400 cursor-not-allowed font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-300">Display Name / Screen Credit</label>
            <input
              type="text"
              required
              placeholder="e.g. Kira Vance"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-300">Call-Sheet Phone</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="+1-555-0192"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-300">Professional Bio</label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <textarea
                rows={2}
                placeholder="Showrunner / DP bio..."
                value={bio}
                onChange={e => setBio(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-lg shadow-cyan-900/30 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Update Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
