import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ExternalLink,
  Film,
  Video,
  Clock,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import type { VaultAssetRecord } from '../../vault/types';
import { formatDuration, formatFileSize } from '../../vault/services/vaultMediaService';
import {
  acquireVaultObjectUrl,
  releaseVaultObjectUrl,
} from '../../vault/services/vaultStorageService';

interface VaultVideoPlayerCardProps {
  assets: VaultAssetRecord[];
  productionId: string;
  onNavigateTab?: (tab: string) => void;
  isDark?: boolean;
}

export function VaultVideoPlayerCard({
  assets,
  productionId,
  onNavigateTab,
  isDark = true,
}: VaultVideoPlayerCardProps) {
  const videoAssets = assets.filter((a) => a.category === 'video');
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const activeAsset = videoAssets[selectedAssetIndex] || null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Acquire media blob ObjectURL when active video asset changes
  useEffect(() => {
    if (!activeAsset) {
      setMediaUrl(null);
      setLoadState('idle');
      return;
    }

    let isMounted = true;
    setLoadState('loading');
    setAutoplayBlocked(false);

    if (activeAsset.externalUrl) {
      setMediaUrl(activeAsset.externalUrl);
      setLoadState('ready');
      return;
    }

    acquireVaultObjectUrl(activeAsset.id, productionId)
      .then((url) => {
        if (!isMounted) return;
        if (url) {
          setMediaUrl(url);
          setLoadState('ready');
        } else {
          setLoadState('error');
        }
      })
      .catch((err) => {
        console.warn('[VaultVideoPlayerCard] Failed to acquire video URL:', err);
        if (isMounted) setLoadState('error');
      });

    return () => {
      isMounted = false;
      if (activeAsset && !activeAsset.externalUrl) {
        releaseVaultObjectUrl(activeAsset.id);
      }
    };
  }, [activeAsset?.id, productionId]);

  // Initiate automatic muted playback once the video element and media URL are ready
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaUrl || loadState !== 'ready') return;

    video.muted = true;
    setIsMuted(true);

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch((err) => {
          console.log('[VaultVideoPlayerCard] Autoplay blocked by browser policy:', err);
          setAutoplayBlocked(true);
          setIsPlaying(false);
        });
    }

    return () => {
      try {
        video.pause();
      } catch {
        // ignore pause error on unmount
      }
    };
  }, [mediaUrl, loadState]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch((err) => {
          console.warn('[VaultVideoPlayerCard] Play failed:', err);
        });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && video.volume === 0) {
      video.volume = 0.8;
      setVolume(0.8);
    }
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    const video = videoRef.current;
    if (video) {
      video.volume = val;
      video.muted = val === 0;
      setIsMuted(val === 0);
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    const video = videoRef.current;
    if (video) {
      video.currentTime = val;
    }
  }, []);

  // Empty State: No real video assets exist in Vault
  if (!activeAsset) {
    return (
      <div
        data-testid="vault-video-empty-state"
        className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#160B24]/90 via-[#0F0B1A]/95 to-[#080B13]/95 backdrop-blur-2xl border border-purple-500/25 shadow-[0_10px_32px_rgba(168,85,247,0.1)] relative overflow-hidden h-full min-h-[220px]"
      >
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <span className="uppercase tracking-wider font-semibold text-purple-200">
              Latest Video Dailies
            </span>
          </div>
          <span className="text-[10px] text-purple-400/80 font-mono">Vault Media</span>
        </div>

        <div className="my-auto py-3 text-center space-y-1.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 mx-auto">
            <Film className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-200">No video dailies uploaded yet</p>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
            Upload footage, assemblies, or visual reference clips in Vault to preview here with automatic playback.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab?.('vault')}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-xs font-medium text-purple-200 transition cursor-pointer"
        >
          <Video className="w-3.5 h-3.5 text-purple-300" />
          <span>Open Production Vault</span>
        </button>
      </div>
    );
  }

  const containerLabel = activeAsset.detectedContainer || activeAsset.originalFilename.split('.').pop()?.toUpperCase() || 'VIDEO';

  return (
    <div
      data-testid="vault-video-player-card"
      className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#160B24]/90 via-[#0F0B1A]/95 to-[#080B13]/95 backdrop-blur-2xl border border-purple-500/25 shadow-[0_10px_32px_rgba(168,85,247,0.1)] overflow-hidden relative group hover:border-purple-500/40 transition-all duration-300 h-full min-h-[220px]"
    >
      {/* Video Viewport Container */}
      <div className="relative w-full aspect-video bg-black/90 flex items-center justify-center overflow-hidden">
        {mediaUrl ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            autoPlay
            muted
            playsInline
            loop
            onTimeUpdate={() => {
              if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
              }
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setDuration(videoRef.current.duration || activeAsset.durationSeconds || 0);
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
            <Film className="w-8 h-8 animate-pulse text-violet-400/50" />
            <span className="text-xs font-mono">Loading Vault Asset…</span>
          </div>
        )}

        {/* Liquid Glass Overlay Controls on Top of Video */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between p-3.5 opacity-90 transition-opacity">
          {/* Top Bar: Multi-Clip Navigation (No Autoplaying pill) */}
          <div className="flex items-center justify-end gap-2">
            {videoAssets.length > 1 && (
              <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-2 py-0.5 text-[10px] font-mono text-slate-300">
                <button
                  type="button"
                  disabled={selectedAssetIndex === 0}
                  onClick={() => setSelectedAssetIndex((prev) => Math.max(0, prev - 1))}
                  className="hover:text-white disabled:opacity-30 cursor-pointer"
                  title="Previous clip"
                >
                  ◀
                </button>
                <span>
                  {selectedAssetIndex + 1}/{videoAssets.length}
                </span>
                <button
                  type="button"
                  disabled={selectedAssetIndex === videoAssets.length - 1}
                  onClick={() => setSelectedAssetIndex((prev) => Math.min(videoAssets.length - 1, prev + 1))}
                  className="hover:text-white disabled:opacity-30 cursor-pointer"
                  title="Next clip"
                >
                  ▶
                </button>
              </div>
            )}
          </div>

          {/* Center Play Button (if autoplay was restricted or paused) */}
          {(!isPlaying || autoplayBlocked) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button
                type="button"
                onClick={togglePlay}
                className="pointer-events-auto p-3.5 rounded-full bg-violet-600/80 hover:bg-violet-500 text-white shadow-lg backdrop-blur-md transition transform hover:scale-110 cursor-pointer"
                title={autoplayBlocked ? 'Click to Start Playback' : 'Play Video'}
              >
                <Play className="w-5 h-5 fill-white ml-0.5" />
              </button>
            </div>
          )}

          {/* Bottom Bar: Scrub Slider, Play/Pause, Mute/Unmute & Time */}
          <div className="space-y-1.5 pt-2">
            {/* Scrub Bar */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-violet-400 hover:h-1.5 transition-all"
              aria-label="Seek video"
            />

            <div className="flex items-center justify-between text-[11px] text-white">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="p-1 rounded hover:bg-white/10 transition cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                </button>

                {/* Sound / Unmute Control */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-1 rounded hover:bg-white/10 transition cursor-pointer"
                    title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
                  >
                    {isMuted ? (
                      <VolumeX className="w-3.5 h-3.5 text-rose-300" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-violet-300" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-14 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-violet-400"
                    aria-label="Volume slider"
                  />
                </div>

                <span className="font-mono text-[10px] text-slate-300">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-black/60 border border-white/10 text-[9px] font-mono uppercase text-slate-300">
                  {containerLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Metadata & Vault Link */}
      <div className="p-4 flex items-center justify-between gap-3 text-xs">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white truncate tracking-tight">
            {activeAsset.name}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
            <span>{formatFileSize(activeAsset.fileSizeBytes)}</span>
            <span>·</span>
            <span>{activeAsset.originalFilename}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab?.('vault')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer shrink-0"
          title="Open original asset in Vault"
        >
          <span>Vault</span>
          <ExternalLink className="w-3 h-3 text-violet-400" />
        </button>
      </div>
    </div>
  );
}
