import React, { useState, useEffect } from 'react';
import { FilmProject } from '../../types';
import { X, Check, AlertCircle, Save, Loader2, ShieldAlert } from 'lucide-react';

interface EditProductionMetadataModalProps {
  project: FilmProject;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<FilmProject> & { genre?: string; productionType?: string; productionCompany?: string }) => Promise<void> | void;
  userRole?: string;
  initialFocusedField?: 'title' | 'logline' | 'director' | 'producer' | 'cinematographer' | 'targetRating' | 'genre' | 'productionType' | 'productionCompany';
}

export function canEditProductionMetadata(role?: string): boolean {
  if (!role) return true;
  const lower = role.toLowerCase().trim();
  if (lower === 'viewer' || lower.includes('viewer') || lower.includes('read-only')) {
    return false;
  }
  if (lower === 'crew_member') {
    return false;
  }
  return true;
}

export function EditProductionMetadataModal({
  project,
  isOpen,
  onClose,
  onSave,
  userRole = 'Line Producer',
  initialFocusedField = 'title',
}: EditProductionMetadataModalProps) {
  const isAuthorized = canEditProductionMetadata(userRole);

  const [title, setTitle] = useState(project.title || '');
  const [logline, setLogline] = useState(project.logline || '');
  const [director, setDirector] = useState(project.director || '');
  const [producer, setProducer] = useState(project.producer || '');
  const [cinematographer, setCinematographer] = useState(project.cinematographer || '');
  const [genre, setGenre] = useState((project as any).genre || (project as any).genres?.[0] || 'Science Fiction');
  const [productionType, setProductionType] = useState(project.productionType || 'Feature Film');
  const [productionCompany, setProductionCompany] = useState(project.productionCompany || (project as any).companyName || '');
  const [targetRating, setTargetRating] = useState<FilmProject['constraints']['targetRating']>(
    project.constraints?.targetRating || 'PG-13'
  );

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Re-sync with project when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(project.title || '');
      setLogline(project.logline || '');
      setDirector(project.director || '');
      setProducer(project.producer || '');
      setCinematographer(project.cinematographer || '');
      setGenre((project as any).genre || (project as any).genres?.[0] || 'Science Fiction');
      setProductionType(project.productionType || 'Feature Film');
      setProductionCompany(project.productionCompany || (project as any).companyName || '');
      setTargetRating(project.constraints?.targetRating || 'PG-13');
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsSaving(false);
    }
  }, [isOpen, project]);

  // Keyboard accessibility: Escape to cancel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isAuthorized) {
      setErrorMessage(`Permission Denied: User role "${userRole}" has read-only access to production metadata.`);
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Production title is required and cannot be empty.');
      return;
    }
    if (trimmedTitle.length > 100) {
      setErrorMessage('Production title cannot exceed 100 characters.');
      return;
    }

    const trimmedLogline = logline.trim();
    if (trimmedLogline.length > 500) {
      setErrorMessage('Logline cannot exceed 500 characters.');
      return;
    }

    const trimmedDirector = director.trim();
    if (trimmedDirector.length > 80) {
      setErrorMessage('Director name cannot exceed 80 characters.');
      return;
    }

    const trimmedProducer = producer.trim();
    if (trimmedProducer.length > 80) {
      setErrorMessage('Producer name cannot exceed 80 characters.');
      return;
    }

    const trimmedDop = cinematographer.trim();
    if (trimmedDop.length > 80) {
      setErrorMessage('Director of Photography name cannot exceed 80 characters.');
      return;
    }

    setIsSaving(true);
    try {
      const updates: any = {
        title: trimmedTitle,
        logline: trimmedLogline,
        director: trimmedDirector || 'Unassigned',
        producer: trimmedProducer || 'Unassigned',
        cinematographer: trimmedDop || 'Unassigned',
        genre: genre.trim(),
        productionType: productionType.trim() || 'Feature Film',
        productionCompany: productionCompany.trim(),
        constraints: {
          ...project.constraints,
          targetRating: targetRating || 'PG-13',
        },
      };

      await onSave(updates);
      setSuccessMessage('Production identity saved successfully.');

      // Brief delay so user sees success feedback, then close
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-production-identity-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-2xl bg-[#070d1d] border border-cyan-500/40 shadow-[0_0_40px_rgba(6,182,212,0.25)] text-left overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 0%, rgba(6, 182, 212, 0.15) 0%, transparent 70%),
            linear-gradient(to right, rgba(6, 182, 212, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6, 182, 212, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 20px 20px, 20px 20px',
        }}
      >
        {/* Subtle top holographic bar */}
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold block">
              Identity & Metadata Calibration
            </span>
            <h2 id="edit-production-identity-title" className="text-lg font-bold text-white tracking-tight">
              Edit Production Identity
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition cursor-pointer"
            aria-label="Close dialog"
            title="Cancel and close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!isAuthorized && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white font-semibold">Editing Restricted</strong>
                <span>
                  Your role (<code className="text-rose-300 font-bold">{userRole}</code>) does not hold metadata modification authority. Production identity can only be updated by project leads.
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Title Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="edit-proj-title" className="font-mono text-zinc-300 font-semibold uppercase text-[11px] tracking-wider">
                Production Title <span className="text-cyan-400">*</span>
              </label>
              <span className={`text-[10px] font-mono ${title.length > 90 ? 'text-amber-400 font-bold' : 'text-zinc-500'}`}>
                {title.length}/100
              </span>
            </div>
            <input
              id="edit-proj-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!isAuthorized || isSaving}
              autoFocus={initialFocusedField === 'title'}
              maxLength={100}
              placeholder="e.g. Neon Dreams, Monsoon Heist"
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-cyan-500/30 text-white font-sans text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 disabled:opacity-50 transition"
              required
            />
          </div>

          {/* Logline Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="edit-proj-logline" className="font-mono text-zinc-300 font-semibold uppercase text-[11px] tracking-wider">
                Logline / Synopsis
              </label>
              <span className={`text-[10px] font-mono ${logline.length > 450 ? 'text-amber-400 font-bold' : 'text-zinc-500'}`}>
                {logline.length}/500
              </span>
            </div>
            <textarea
              id="edit-proj-logline"
              rows={3}
              value={logline}
              onChange={(e) => setLogline(e.target.value)}
              disabled={!isAuthorized || isSaving}
              autoFocus={initialFocusedField === 'logline'}
              maxLength={500}
              placeholder="A concise, compelling sentence summarizing the dramatic conflict..."
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-cyan-500/30 text-zinc-200 font-sans text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 disabled:opacity-50 transition resize-none leading-relaxed"
            />
          </div>

          {/* Key Creative Leads: 3 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Director */}
            <div className="space-y-1">
              <label htmlFor="edit-proj-director" className="font-mono text-zinc-400 text-[10px] uppercase tracking-wider block">
                Director (Dir)
              </label>
              <input
                id="edit-proj-director"
                type="text"
                value={director}
                onChange={(e) => setDirector(e.target.value)}
                disabled={!isAuthorized || isSaving}
                autoFocus={initialFocusedField === 'director'}
                maxLength={80}
                placeholder="Elena Rostova"
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 disabled:opacity-50 transition"
              />
            </div>

            {/* Producer */}
            <div className="space-y-1">
              <label htmlFor="edit-proj-producer" className="font-mono text-zinc-400 text-[10px] uppercase tracking-wider block">
                Producer (Prod)
              </label>
              <input
                id="edit-proj-producer"
                type="text"
                value={producer}
                onChange={(e) => setProducer(e.target.value)}
                disabled={!isAuthorized || isSaving}
                autoFocus={initialFocusedField === 'producer'}
                maxLength={80}
                placeholder="Marcus Thorne"
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 disabled:opacity-50 transition"
              />
            </div>

            {/* DoP */}
            <div className="space-y-1">
              <label htmlFor="edit-proj-dop" className="font-mono text-zinc-400 text-[10px] uppercase tracking-wider block">
                Cinematographer (DoP)
              </label>
              <input
                id="edit-proj-dop"
                type="text"
                value={cinematographer}
                onChange={(e) => setCinematographer(e.target.value)}
                disabled={!isAuthorized || isSaving}
                autoFocus={initialFocusedField === 'cinematographer'}
                maxLength={80}
                placeholder="Jack Miller"
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 disabled:opacity-50 transition"
              />
            </div>
          </div>

          {/* Genre, Production Type, Production Company: 3 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Genre */}
            <div className="space-y-1">
              <label htmlFor="edit-proj-genre" className="font-mono text-zinc-400 text-[10px] uppercase tracking-wider block">
                Primary Genre
              </label>
              <select
                id="edit-proj-genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                disabled={!isAuthorized || isSaving}
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-400 disabled:opacity-50 cursor-pointer"
              >
                <option value="Drama">Drama</option>
                <option value="Thriller">Thriller</option>
                <option value="Science Fiction">Science Fiction</option>
                <option value="Action">Action</option>
                <option value="Romance">Romance</option>
                <option value="Comedy">Comedy</option>
                <option value="Documentary">Documentary</option>
                <option value="Mystery">Mystery</option>
                <option value="Crime">Crime</option>
                <option value="Horror">Horror</option>
              </select>
            </div>

            {/* Production Type */}
            <div className="space-y-1">
              <label htmlFor="edit-proj-type" className="font-mono text-zinc-400 text-[10px] uppercase tracking-wider block">
                Production Type
              </label>
              <select
                id="edit-proj-type"
                value={productionType}
                onChange={(e) => setProductionType(e.target.value)}
                disabled={!isAuthorized || isSaving}
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 disabled:opacity-50 cursor-pointer"
              >
                <option value="Feature Film">Feature Film</option>
                <option value="Limited Series">Limited Series</option>
                <option value="Series">Series</option>
                <option value="Short Film">Short Film</option>
                <option value="Commercial">Commercial</option>
                <option value="Documentary">Documentary</option>
              </select>
            </div>

            {/* Production Company */}
            <div className="space-y-1">
              <label htmlFor="edit-proj-company" className="font-mono text-zinc-400 text-[10px] uppercase tracking-wider block">
                Production Company
              </label>
              <input
                id="edit-proj-company"
                type="text"
                value={productionCompany}
                onChange={(e) => setProductionCompany(e.target.value)}
                disabled={!isAuthorized || isSaving}
                maxLength={80}
                placeholder="e.g. A24 / Plan B"
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 disabled:opacity-50 transition"
              />
            </div>
          </div>

          {/* Classification Rating */}
          <div className="pt-2 flex items-center justify-between text-xs border-t border-zinc-850">
            <label htmlFor="edit-proj-rating" className="font-mono text-zinc-400 text-[11px] uppercase tracking-wider">
              Target Rating / Classification
            </label>
            <select
              id="edit-proj-rating"
              value={targetRating}
              onChange={(e) => setTargetRating(e.target.value as any)}
              disabled={!isAuthorized || isSaving}
              className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-400 disabled:opacity-50 cursor-pointer"
            >
              <option value="G">G — General Audiences</option>
              <option value="PG">PG — Parental Guidance</option>
              <option value="PG-13">PG-13 — Parents Strongly Cautioned</option>
              <option value="R">R — Restricted (Adults 17+)</option>
              <option value="NC-17">NC-17 — Adults Only</option>
              <option value="U">U — Universal (CBFC)</option>
              <option value="UA">UA — Parental Guidance (CBFC)</option>
              <option value="A">A — Adults Only (CBFC)</option>
              <option value="S">S — Specialized (CBFC)</option>
            </select>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-cyan-500/20">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 text-zinc-300 text-xs font-mono transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isAuthorized || isSaving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold tracking-wider uppercase transition shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
