import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Music,
  ExternalLink,
  Disc,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import type { VaultAssetRecord } from '../../vault/types';
import { formatDuration, formatFileSize } from '../../vault/services/vaultMediaService';
import {
  acquireVaultObjectUrl,
  releaseVaultObjectUrl,
} from '../../vault/services/vaultStorageService';

interface VaultAudioPlayerCardProps {
  assets: VaultAssetRecord[];
  productionId: string;
  onNavigateTab?: (tab: string) => void;
  isDark?: boolean;
}

export function VaultAudioPlayerCard({
  assets,
  productionId,
  onNavigateTab,
  isDark = true,
}: VaultAudioPlayerCardProps) {
  const audioAssets = assets.filter((a) => a.category === 'audio');
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const activeAsset = audioAssets[selectedAssetIndex] || null;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!activeAsset) {
      setMediaUrl(null);
      return;
    }

    let isMounted = true;
    if (activeAsset.externalUrl) {
      setMediaUrl(activeAsset.externalUrl);
      return;
    }

    acquireVaultObjectUrl(activeAsset.id, productionId)
      .then((url) => {
        if (!isMounted) return;
        setMediaUrl(url);
      })
      .catch((err) => {
        console.warn('[VaultAudioPlayerCard] Failed to acquire audio URL:', err);
      });

    return () => {
      isMounted = false;
      if (activeAsset && !activeAsset.externalUrl) {
        releaseVaultObjectUrl(activeAsset.id);
      }
    };
  }, [activeAsset?.id, productionId]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn('[VaultAudioPlayerCard] Playback failed:', err));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextMuted = !audio.muted;
    audio.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = val;
      audio.muted = val === 0;
      setIsMuted(val === 0);
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = val;
    }
  }, []);

  // Empty State: Apple Music-inspired sleek horizontal rectangular bar with connected Cyan gradient
  if (!activeAsset) {
    return (
      <div
        data-testid="vault-audio-empty-state"
        className="w-full flex items-center justify-between gap-4 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#071825]/90 via-[#07131D]/95 to-[#080D16]/95 backdrop-blur-xl border border-cyan-500/25 shadow-[0_8px_30px_rgba(6,182,212,0.1)] hover:border-cyan-500/40 transition-all"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            <Music className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white tracking-tight">Vault Audio Deck</span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-[9.5px] font-mono text-cyan-300 border border-cyan-500/20 uppercase">
                Standby
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              No audio tracks uploaded · Upload temp scores, stems, or sound effects in Vault
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab?.('vault')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-medium text-cyan-200 hover:text-white transition cursor-pointer shrink-0 shadow-sm"
        >
          <Music className="w-3.5 h-3.5 text-cyan-300" />
          <span>Upload Audio</span>
        </button>
      </div>
    );
  }

  const containerLabel = activeAsset.detectedContainer || activeAsset.originalFilename.split('.').pop()?.toUpperCase() || 'AUDIO';

  return (
    <div
      data-testid="vault-audio-player-card"
      className="w-full flex flex-col md:flex-row items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#071825]/90 via-[#07131D]/95 to-[#080D16]/95 backdrop-blur-2xl border border-cyan-500/25 shadow-[0_10px_32px_rgba(6,182,212,0.12)] group hover:border-cyan-500/40 transition-all duration-300"
    >
      {mediaUrl && (
        <audio
          ref={audioRef}
          src={mediaUrl}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration || activeAsset.durationSeconds || 0);
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Left: Artwork / Disc Thumbnail & Metadata */}
      <div className="flex items-center gap-3 min-w-0 md:w-1/3">
        <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-inner">
          <Disc className={`w-5 h-5 text-cyan-400 ${isPlaying ? 'animate-spin' : ''}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-xs text-white truncate tracking-tight">
            {activeAsset.name}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mt-0.5 truncate">
            <span className="px-1.5 py-0.2 rounded bg-white/[0.05] border border-white/10 text-cyan-300">
              {containerLabel}
            </span>
            <span>·</span>
            <span>{formatFileSize(activeAsset.fileSizeBytes)}</span>
          </div>
        </div>
      </div>

      {/* Center: Play/Pause, Prev/Next & Full-Width Scrub Slider (Apple Music style) */}
      <div className="flex-1 w-full md:max-w-md flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          {audioAssets.length > 1 && (
            <button
              type="button"
              disabled={selectedAssetIndex === 0}
              onClick={() => setSelectedAssetIndex((prev) => Math.max(0, prev - 1))}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Previous track"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={togglePlay}
            className="p-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-md transition transform hover:scale-105 cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>

          {audioAssets.length > 1 && (
            <button
              type="button"
              disabled={selectedAssetIndex === audioAssets.length - 1}
              onClick={() => setSelectedAssetIndex((prev) => Math.min(audioAssets.length - 1, prev + 1))}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Next track"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Scrub Bar & Times */}
        <div className="w-full flex items-center gap-2 text-[10px] font-mono text-slate-400">
          <span className="w-9 text-right shrink-0">{formatDuration(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:h-1.5 transition-all"
            aria-label="Seek audio track"
          />
          <span className="w-9 shrink-0">{formatDuration(duration || activeAsset.durationSeconds)}</span>
        </div>
      </div>

      {/* Right: Volume & Vault Link */}
      <div className="flex items-center gap-3 shrink-0 md:w-1/4 justify-end">
        <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
          <button
            type="button"
            onClick={toggleMute}
            className="p-1 rounded hover:text-white transition cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-slate-300" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            aria-label="Volume slider"
          />
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab?.('vault')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer"
          title="Open asset in Vault"
        >
          <span>Vault</span>
          <ExternalLink className="w-3 h-3 text-cyan-400" />
        </button>
      </div>
    </div>
  );
}
