import React, { useState, useMemo, useCallback } from 'react';
import {
  Columns2,
  Plus,
  Trash2,
  Clock,
  Download,
  Copy,
  Check,
  Film,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Volume2,
  Video,
  FileSpreadsheet,
} from 'lucide-react';
import { FilmProject, ScreenplayVersion, ParsedScene } from '../../../types';

export interface AVCueItem {
  id: string;
  shotNumber: number;
  durationSeconds: number;
  visual: string;
  audio: string;
  speaker?: string;
}

export interface AVScriptWorkspaceProps {
  project: FilmProject;
  activeScreenplayVersion?: ScreenplayVersion | null;
  onNavigateTab?: (tab: string, submodule?: string) => void;
  readOnly?: boolean;
}

const DEFAULT_AV_CUES: AVCueItem[] = [
  {
    id: 'av-1',
    shotNumber: 1,
    durationSeconds: 5,
    visual: 'EXT. METROPOLIS SKYLINE - DAWN\nWide aerial tracking shot over waking city towers as fog lifts.',
    audio: 'MUSIC: Low atmospheric synth swell begins under soft traffic murmur.',
  },
  {
    id: 'av-2',
    shotNumber: 2,
    durationSeconds: 10,
    visual: 'INT. PRODUCTION STAGE - DAY\nMedium dolly on camera crew preparing lens turret. Clapper slate enters frame.',
    audio: 'DIRECTOR (V.O.)\nEvery frame begins with a single decision. Light. Shadow. Perspective.',
  },
  {
    id: 'av-3',
    shotNumber: 3,
    durationSeconds: 8,
    visual: 'CLOSE UP on actor sitting at makeup mirror, taking a deep breath.',
    audio: 'SFX: Camera shutter fires. Sound of studio chatter drops to dead silence.',
  },
  {
    id: 'av-4',
    shotNumber: 4,
    durationSeconds: 7,
    visual: 'GRAPHIC: SceneOS Title mark resolves over deep charcoal matte with subtle gold amber accent.',
    audio: 'VOICEOVER\nSceneOS. From canonical script to the first day of principal photography.',
  },
];

function formatDurationSeconds(sec: number): string {
  const mins = Math.floor(sec / 60);
  const remainingSec = sec % 60;
  return `${mins.toString().padStart(2, '0')}:${remainingSec.toString().padStart(2, '0')}`;
}

export const AVScriptWorkspace: React.FC<AVScriptWorkspaceProps> = ({
  project,
  activeScreenplayVersion,
  onNavigateTab,
  readOnly = false,
}) => {
  const [scriptTitle, setScriptTitle] = useState<string>(
    `${project.title || 'Project'} — Commercial / Promo AV Script`
  );
  const [targetSeconds, setTargetSeconds] = useState<number>(30);
  const [cues, setCues] = useState<AVCueItem[]>(DEFAULT_AV_CUES);
  const [copied, setCopied] = useState<boolean>(false);

  // Calculate total duration
  const totalSeconds = useMemo(() => {
    return cues.reduce((sum, cue) => sum + (cue.durationSeconds || 0), 0);
  }, [cues]);

  // Add new cue
  const handleAddCue = useCallback(() => {
    if (readOnly) return;
    setCues((prev) => {
      const nextNum = prev.length + 1;
      const newCue: AVCueItem = {
        id: `av-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        shotNumber: nextNum,
        durationSeconds: 5,
        visual: '',
        audio: '',
      };
      return [...prev, newCue];
    });
  }, [readOnly]);

  // Update cue field
  const handleUpdateCue = useCallback(
    (id: string, field: 'visual' | 'audio' | 'durationSeconds', value: any) => {
      if (readOnly) return;
      setCues((prev) =>
        prev.map((c) => {
          if (c.id === id) {
            return { ...c, [field]: value };
          }
          return c;
        })
      );
    },
    [readOnly]
  );

  // Delete cue
  const handleDeleteCue = useCallback(
    (id: string) => {
      if (readOnly) return;
      setCues((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        return filtered.map((c, i) => ({ ...c, shotNumber: i + 1 }));
      });
    },
    [readOnly]
  );

  // Move cue
  const handleMoveCue = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if (readOnly) return;
      setCues((prev) => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= prev.length) return prev;
        const copy = [...prev];
        const [moved] = copy.splice(index, 1);
        copy.splice(targetIndex, 0, moved);
        return copy.map((c, i) => ({ ...c, shotNumber: i + 1 }));
      });
    },
    [readOnly]
  );

  // Seed from current screenplay scenes if available
  const handleSeedFromScreenplay = useCallback(() => {
    if (readOnly) return;
    const scenes: ParsedScene[] = activeScreenplayVersion?.scenes || [];
    if (scenes.length === 0) return;

    const newCues: AVCueItem[] = scenes.slice(0, 15).map((scn, idx) => {
      const visualDesc = [
        scn.heading,
        scn.synopsis || scn.actionText || '',
      ].filter(Boolean).join('\n');

      const audioLines = (scn.dialogueBlocks || [])
        .map((d) => `${d.character}:\n${d.text}`)
        .join('\n\n');

      const eighths = scn.pageEighths || 8;
      const estimatedSec = Math.max(5, Math.round((eighths / 8) * 60));

      return {
        id: `av-seeded-${scn.id}-${idx}`,
        shotNumber: idx + 1,
        durationSeconds: Math.min(estimatedSec, 45),
        visual: visualDesc || `SCENE ${scn.sceneNumber}`,
        audio: audioLines || 'SFX: Ambient production sound.',
      };
    });

    setCues(newCues);
  }, [activeScreenplayVersion, readOnly]);

  // Export as formatted text table
  const handleExportText = useCallback(() => {
    const header = `=== ${scriptTitle.toUpperCase()} ===\nTOTAL DURATION: ${formatDurationSeconds(totalSeconds)} (${totalSeconds}s) | TARGET: ${targetSeconds}s\n\n`;
    const rows = cues
      .map(
        (c) =>
          `[SHOT ${c.shotNumber.toString().padStart(2, '0')}] (${c.durationSeconds}s)\nVISUAL:\n${c.visual}\n\nAUDIO:\n${c.audio}\n----------------------------------------`
      )
      .join('\n\n');

    const fullContent = header + rows;
    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scriptTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-av-script.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [cues, scriptTitle, targetSeconds, totalSeconds]);

  // Copy to clipboard
  const handleCopyClipboard = useCallback(() => {
    const text = cues
      .map(
        (c) =>
          `SHOT ${c.shotNumber} (${c.durationSeconds}s)\nVISUAL: ${c.visual}\nAUDIO: ${c.audio}`
      )
      .join('\n\n');
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [cues]);

  return (
    <div
      data-testid="screenplay-av-script-workspace"
      className="flex-1 flex flex-col h-full bg-[#050714]/80 backdrop-blur-xl text-slate-100 overflow-hidden select-none"
    >
      {/* Top Header & Actions Bar */}
      <div className="h-14 px-6 border-b border-cyan-500/15 bg-[#080b1a]/85 backdrop-blur-xl flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
            <Columns2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <input
              type="text"
              value={scriptTitle}
              onChange={(e) => setScriptTitle(e.target.value)}
              disabled={readOnly}
              data-testid="av-script-title-input"
              className="text-sm font-semibold bg-transparent text-slate-100 focus:outline-none focus:border-b focus:border-cyan-400 transition truncate max-w-md"
            />
            <p className="text-[11px] text-slate-400">
              Two-Column Audio/Visual Script Format for Commercials, Promos & Documentaries
            </p>
          </div>
        </div>

        {/* Runtime KPIs & Toolbar Actions */}
        <div className="flex items-center gap-3">
          {/* Target Runtime Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-cyan-500/20 text-xs">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 text-[11px]">Duration:</span>
            <span className="font-mono font-bold text-slate-100">
              {formatDurationSeconds(totalSeconds)}
            </span>
            <span className="text-slate-500 font-mono text-[10px]">/ {targetSeconds}s</span>
          </div>

          {/* Quick presets */}
          <div className="hidden lg:flex items-center gap-1">
            {[15, 30, 60, 90].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setTargetSeconds(sec)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                  targetSeconds === sec
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                    : 'bg-white/[0.03] text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                :{sec}s
              </button>
            ))}
          </div>

          {/* Convert from Screenplay Button */}
          {activeScreenplayVersion?.scenes && activeScreenplayVersion.scenes.length > 0 && (
            <button
              type="button"
              onClick={handleSeedFromScreenplay}
              disabled={readOnly}
              data-testid="av-seed-from-screenplay-btn"
              title="Populate AV cues from current screenplay scenes"
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Import from Script</span>
            </button>
          )}

          {/* Add Cue Button */}
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddCue}
              data-testid="av-add-cue-btn"
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(6,182,212,0.35)] transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Cue</span>
            </button>
          )}

          {/* Export & Copy */}
          <button
            type="button"
            onClick={handleCopyClipboard}
            data-testid="av-copy-btn"
            title="Copy AV script text to clipboard"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleExportText}
            data-testid="av-export-btn"
            title="Download formatted AV script document"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="h-10 px-6 bg-[#080b1a]/95 border-b border-cyan-500/15 grid grid-cols-12 gap-4 items-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">
        <div className="col-span-1 text-center font-mono text-[10px]"># / TIME</div>
        <div className="col-span-5 flex items-center gap-1.5 text-violet-300">
          <Video className="w-3.5 h-3.5 text-violet-400" />
          <span>VISUAL / VIDEO DIRECTION</span>
        </div>
        <div className="col-span-5 flex items-center gap-1.5 text-cyan-300">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>AUDIO / NARRATION & DIALOGUE</span>
        </div>
        <div className="col-span-1 text-right">ACTIONS</div>
      </div>

      {/* Columnar Cue List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 scrollbar-cinema">
        {cues.map((cue, idx) => (
          <div
            key={cue.id}
            data-testid={`av-cue-row-${cue.id}`}
            className="grid grid-cols-12 gap-4 items-start p-3 rounded-xl bg-[#090d22]/60 hover:bg-[#0c122e]/70 border border-cyan-500/10 hover:border-cyan-500/25 transition-colors group"
          >
            {/* Shot Number & Duration */}
            <div className="col-span-1 flex flex-col items-center justify-center gap-1 pt-1">
              <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                {cue.shotNumber.toString().padStart(2, '0')}
              </span>
              <div className="flex items-center gap-0.5 text-[10px] text-slate-400 mt-1">
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={cue.durationSeconds}
                  onChange={(e) =>
                    handleUpdateCue(
                      cue.id,
                      'durationSeconds',
                      Math.max(1, parseInt(e.target.value, 10) || 1)
                    )
                  }
                  disabled={readOnly}
                  className="w-10 text-center font-mono bg-black/40 border border-white/[0.1] rounded px-1 py-0.5 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
                <span>s</span>
              </div>
            </div>

            {/* Visual Column */}
            <div className="col-span-5">
              <textarea
                value={cue.visual}
                onChange={(e) => handleUpdateCue(cue.id, 'visual', e.target.value)}
                placeholder="Camera angle, movement, graphics, actor blocking..."
                rows={3}
                disabled={readOnly}
                data-testid={`av-cue-visual-${cue.id}`}
                className="w-full text-xs font-mono p-2.5 rounded-lg bg-black/30 border border-white/[0.08] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-400/80 resize-y leading-relaxed"
              />
            </div>

            {/* Audio Column */}
            <div className="col-span-5">
              <textarea
                value={cue.audio}
                onChange={(e) => handleUpdateCue(cue.id, 'audio', e.target.value)}
                placeholder="Voiceover (V.O.), talent speech, sound effects (SFX), music bed..."
                rows={3}
                disabled={readOnly}
                data-testid={`av-cue-audio-${cue.id}`}
                className="w-full text-xs font-mono p-2.5 rounded-lg bg-black/30 border border-white/[0.08] text-cyan-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/80 resize-y leading-relaxed"
              />
            </div>

            {/* Row Actions */}
            <div className="col-span-1 flex flex-col items-end gap-1 pt-1 opacity-70 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleMoveCue(idx, 'up')}
                  disabled={idx === 0 || readOnly}
                  title="Move Cue Up"
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-20 cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveCue(idx, 'down')}
                  disabled={idx === cues.length - 1 || readOnly}
                  title="Move Cue Down"
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-20 cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleDeleteCue(cue.id)}
                  title="Delete Cue"
                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Empty Cue State */}
        {cues.length === 0 && (
          <div className="py-12 text-center text-slate-400 space-y-3">
            <FileSpreadsheet className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm">No cues in this AV Script yet.</p>
            <button
              type="button"
              onClick={handleAddCue}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 text-xs font-semibold cursor-pointer shadow-[0_0_14px_rgba(6,182,212,0.35)]"
            >
              Add First Cue
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
