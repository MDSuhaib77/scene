/**
 * SceneOS — First-Run Production Onboarding Wizard
 * 
 * Cinematic, restrained onboarding experience for new filmmakers and producers:
 * - Multi-role selection across key film departments
 * - Production goal specification (new project, screenplay ingestion, explore workspace)
 * - Experience level / production scale & guild framework
 * - Non-blocking: users can skip directly to the workspace at any time
 * - Persists completion state per authenticated user
 */

import React, { useState } from 'react';
import { 
  Film, 
  Clapperboard, 
  FileText, 
  Sparkles, 
  Check, 
  ArrowRight, 
  Camera, 
  UserCheck, 
  Scissors, 
  Volume2, 
  ShieldCheck, 
  Compass,
  Layers,
  ChevronRight
} from 'lucide-react';

interface OnboardingWizardProps {
  userName: string;
  userEmail?: string;
  onComplete: (data: { roles: string[]; goal: string; scale: string }) => void;
  onSkip: () => void;
}

const AVAILABLE_ROLES = [
  { id: 'Director', label: 'Director', icon: Clapperboard, desc: 'Vision, scene pacing & creative decisions' },
  { id: 'Producer', label: 'Producer', icon: UserCheck, desc: 'Production planning, logistics & team leadership' },
  { id: 'Line Producer', label: 'Line Producer', icon: ShieldCheck, desc: 'Schedules, logistics & operational workflows' },
  { id: '1st Assistant Director', label: '1st AD', icon: Film, desc: 'Stripboards, call sheets & set efficiency' },
  { id: 'Cinematographer', label: 'DoP / Camera', icon: Camera, desc: 'Shot lists, lighting & visual look' },
  { id: 'Screenwriter', label: 'Screenwriter', icon: FileText, desc: 'Draft revisions, scene breakdowns & dialogue' },
  { id: 'Lead Editor', label: 'Lead Editor', icon: Scissors, desc: 'Assembly, rough cuts & post timeline' },
  { id: 'Sound Designer', label: 'Sound / Audio', icon: Volume2, desc: 'Foley, mix passes & delivery specs' },
];

const PRODUCTION_GOALS = [
  {
    id: 'start-project',
    title: 'Start a New Production',
    description: 'Set up a new production pipeline with milestones, phases, and crew roster from scratch.',
    icon: Clapperboard,
  },
  {
    id: 'import-script',
    title: 'Ingest Existing Screenplay',
    description: 'Import Final Draft (.fdx), Fountain, PDF, or Word files for automated eighths breakdown.',
    icon: FileText,
  },
  {
    id: 'explore-demo',
    title: 'Explore Demo Workspace',
    description: 'Tour the pre-configured "Neon Dreams" cyberpunk indie production with real schedules.',
    icon: Sparkles,
  },
];

const PRODUCTION_SCALES = [
  { id: 'indie-micro', label: 'Indie / Micro Scale', detail: 'High agility, lean creative crew' },
  { id: 'mid-budget', label: 'Regional / Feature Scale', detail: 'Standard multi-week production shoot' },
  { id: 'studio-high', label: 'Studio / Flagship Scale', detail: 'Multi-unit, large-scale cinematic production' },
  { id: 'commercial', label: 'Commercial / Short', detail: 'Fast turnaround, compact sprints' },
];

export function OnboardingWizard({ userName, userEmail, onComplete, onSkip }: OnboardingWizardProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['Line Producer']);
  const [selectedGoal, setSelectedGoal] = useState<string>('explore-demo');
  const [selectedScale, setSelectedScale] = useState<string>('mid-budget');
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(roleId)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter(r => r !== roleId);
      } else {
        return [...prev, roleId];
      }
    });
  };

  const handleFinish = () => {
    onComplete({
      roles: selectedRoles,
      goal: selectedGoal,
      scale: selectedScale,
    });
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 md:p-8 animate-fade-in font-sans">
      <div className="w-full max-w-3xl bg-[#090D16] border border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="p-6 md:p-8 border-b border-zinc-850 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
                First-Run Configuration
              </span>
              <span className="text-zinc-600 text-xs">•</span>
              <span className="text-zinc-400 text-xs font-mono">Step {step} of 3</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              {step === 1 && 'Select Your Primary Production Roles'}
              {step === 2 && 'What would you like to do first?'}
              {step === 3 && 'Choose Your Typical Production Scale'}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {step === 1 && 'Select one or more hats you wear. SceneOS customizes your dashboard and navigation accordingly.'}
              {step === 2 && 'You can create additional projects, import scripts, or change workspace anytime.'}
              {step === 3 && 'Calibrates default turnaround buffers, shooting schedules, and production profiles.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition px-3 py-1.5 rounded-lg hover:bg-zinc-800/60 font-mono"
            title="Skip onboarding and enter dashboard directly"
          >
            Skip for now →
          </button>
        </div>

        {/* Step Content */}
        <div className="p-6 md:p-8 min-h-[360px] flex flex-col justify-between">
          {/* STEP 1: ROLES */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AVAILABLE_ROLES.map(r => {
                const isSelected = selectedRoles.includes(r.id);
                const IconComponent = r.icon;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.id)}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500/50 shadow-sm shadow-cyan-950/40 text-white'
                        : 'bg-zinc-950/40 border-zinc-850 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      isSelected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-900 text-zinc-500'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold tracking-wide text-zinc-100">{r.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{r.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 2: IMMEDIATE GOAL */}
          {step === 2 && (
            <div className="space-y-3.5">
              {PRODUCTION_GOALS.map(g => {
                const isSelected = selectedGoal === g.id;
                const IconComponent = g.icon;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGoal(g.id)}
                    className={`w-full p-4 rounded-2xl border text-left transition cursor-pointer flex items-center gap-4 ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500/50 shadow-sm shadow-cyan-950/40'
                        : 'bg-zinc-950/40 border-zinc-850 hover:border-zinc-700'
                    }`}
                  >
                    <div className={`p-3 rounded-xl shrink-0 ${
                      isSelected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-900 text-zinc-500'
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-zinc-100">{g.title}</h3>
                        {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{g.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 3: PRODUCTION SCALE */}
          {step === 3 && (
            <div className="space-y-3">
              {PRODUCTION_SCALES.map(s => {
                const isSelected = selectedScale === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedScale(s.id)}
                    className={`w-full p-4 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500/50 shadow-sm shadow-cyan-950/40'
                        : 'bg-zinc-950/40 border-zinc-850 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-100 tracking-wide">{s.label}</h3>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{s.detail}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                  </button>
                );
              })}

              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 text-[11px] text-zinc-400 flex items-center gap-2 mt-4">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Automatic Indian Guild (FWICE / WICA / SICA) and SAG-AFTRA 12-hour turnaround & meal break validations are enabled by default.
                </span>
              </div>
            </div>
          )}

          {/* Bottom Navigation */}
          <div className="pt-6 mt-6 border-t border-zinc-850 flex items-center justify-between">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((step - 1) as any)}
                  className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition rounded-xl hover:bg-zinc-850"
                >
                  ← Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
                {selectedRoles.join(', ')}
              </span>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((step + 1) as any)}
                  className="px-5 py-2.5 rounded-xl text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center gap-1.5 shadow-lg shadow-cyan-900/30 cursor-pointer"
                >
                  <span>Continue</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="px-6 py-2.5 rounded-xl text-xs font-medium bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white transition flex items-center gap-1.5 shadow-lg shadow-cyan-900/30 cursor-pointer font-semibold"
                >
                  <span>Enter Studio Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
