/**
 * SceneOS — Create Production Modal
 * Understated, premium production creation experience for filmmakers.
 */

import React, { useState, useEffect } from 'react';
import { Clapperboard, AlertCircle, X } from 'lucide-react';
import { useProject } from './ProjectContext';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (project: any) => void;
}

export function CreateProjectModal({ isOpen, onClose, onCreated }: CreateProjectModalProps) {
  const { createProject } = useProject();

  const [title, setTitle] = useState('');
  const [productionType, setProductionType] = useState('Feature Film');
  const [companyName, setCompanyName] = useState('');
  const [director, setDirector] = useState('');
  const [primaryLocation, setPrimaryLocation] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setValidationError('Production title is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const created = await createProject({
        title: trimmedTitle,
        productionType,
        companyName: companyName.trim() || undefined,
        productionCompany: companyName.trim() || undefined,
        director: director.trim() || undefined,
        primaryLocation: primaryLocation.trim() || undefined,
        status: 'development',
        budgetTotal: 0,
        dailyBurnCap: 0,
        startDate: todayStr,
      } as any);

      // Reset form fields
      setTitle('');
      setProductionType('Feature Film');
      setCompanyName('');
      setDirector('');
      setPrimaryLocation('');

      onClose();
      if (onCreated) {
        onCreated(created);
      }
    } catch (err: any) {
      setValidationError(err.message || 'Failed to create production.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={e => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-[#0D1017] border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 pb-5 border-b border-white/[0.06] flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
              <Clapperboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Create production</h2>
              <p className="text-xs text-slate-400 mt-0.5">Start with the essentials. You can add details as you go.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer disabled:opacity-40"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* 1. Production Title (Prominent & Required) */}
          <div className="space-y-1.5">
            <label htmlFor="input-create-production-title" className="text-xs font-medium text-slate-300 block">
              Production title <span className="text-cyan-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              id="input-create-production-title"
              placeholder="e.g. Neon Horizon"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.08] focus:border-cyan-500/50 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner"
            />
          </div>

          {/* 2. Production Type / Format (Required, immediately below Title) */}
          <div className="space-y-1.5">
            <label htmlFor="select-create-production-type" className="text-xs font-medium text-slate-300 block">
              Production type / format <span className="text-cyan-400">*</span>
            </label>
            <select
              id="select-create-production-type"
              value={productionType}
              onChange={e => setProductionType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.08] focus:border-cyan-500/50 rounded-xl text-xs text-slate-200 focus:outline-none transition"
            >
              <option value="Feature Film" className="bg-[#0D1017] text-white">Feature Film</option>
              <option value="Short Film" className="bg-[#0D1017] text-white">Short Film</option>
              <option value="Episodic / Series" className="bg-[#0D1017] text-white">Episodic / Series</option>
              <option value="Commercial" className="bg-[#0D1017] text-white">Commercial</option>
              <option value="Documentary" className="bg-[#0D1017] text-white">Documentary</option>
            </select>
          </div>

          {/* 3 & 4. Production Company / Studio & Director (Compact Two-Column Row) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="input-create-production-company" className="text-xs font-medium text-slate-300 block">
                Production company / studio
              </label>
              <input
                type="text"
                id="input-create-production-company"
                placeholder="e.g. Syncopy, A24"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="w-full px-3.5 py-2 bg-black/40 border border-white/[0.08] focus:border-cyan-500/50 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="input-create-production-director" className="text-xs font-medium text-slate-300 block">
                Director
              </label>
              <input
                type="text"
                id="input-create-production-director"
                placeholder="Director name"
                value={director}
                onChange={e => setDirector(e.target.value)}
                className="w-full px-3.5 py-2 bg-black/40 border border-white/[0.08] focus:border-cyan-500/50 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
              />
            </div>
          </div>

          {/* 5. Primary Location (Optional, Final Full-Width Row) */}
          <div className="space-y-1.5">
            <label htmlFor="input-create-production-location" className="text-xs font-medium text-slate-300 block">
              Primary location
            </label>
            <input
              type="text"
              id="input-create-production-location"
              placeholder="e.g. London, Mumbai, Los Angeles"
              value={primaryLocation}
              onChange={e => setPrimaryLocation(e.target.value)}
              className="w-full px-3.5 py-2 bg-black/40 border border-white/[0.08] focus:border-cyan-500/50 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 mt-2 border-t border-white/[0.06] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-sm shadow-cyan-950/40 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              id="btn-submit-create-production"
            >
              {isSubmitting ? 'Creating production...' : 'Create production'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
