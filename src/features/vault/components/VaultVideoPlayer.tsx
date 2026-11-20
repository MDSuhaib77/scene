import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { VaultAssetRecord } from '../types';
import { formatDuration, formatFileSize } from '../services/vaultMediaService';
import {
  acquireVaultObjectUrl,
  releaseVaultObjectUrl,
} from '../services/vaultStorageService';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const FRAME_STEP_SECONDS = 1 / 24;

interface VaultVideoPlayerProps {
  asset: VaultAssetRecord;
  productionId: string;
}

export const VaultVideoPlayer: React.FC<VaultVideoPlayerProps> = ({
  asset,
  productionId,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const controlsVisibleRef = useRef<boolean>(true);
  const seekInputRef = useRef<HTMLInputElement | null>(null);
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const timeLabelRef = useRef<HTMLSpanElement | null>(null);
  const durationRef = useRef<number>(asset.durationSeconds || 0);
  const isSeekingRef = useRef<boolean>(false);

  const [mediaUrl, setMediaUrl] = useState<string | null>(asset.externalUrl || null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'unsupported'>(
    asset.externalUrl ? 'ready' : 'loading'
  );
  const [isBuffering, setIsBuffering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(asset.durationSeconds || 0);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supportsPip =
    typeof document !== 'undefined' && Boolean(document.pictureInPictureEnabled);

  // Update scrubber DOM refs directly so video playback never triggers React re-renders per frame/timeupdate
  const syncProgressDom = useCallback((timeVal: number, totalVal: number) => {
    const safeTotal = totalVal > 0 ? totalVal : 0;
    const clamped = safeTotal > 0 ? Math.max(0, Math.min(safeTotal, timeVal)) : 0;
    if (timeLabelRef.current) {
      timeLabelRef.current.textContent = formatDuration(clamped);
    }
    if (seekInputRef.current && !isSeekingRef.current) {
      seekInputRef.current.max = String(safeTotal > 0 ? safeTotal : 100);
      seekInputRef.current.value = String(clamped);
    }
    if (progressFillRef.current) {
      const pct = safeTotal > 0 ? (clamped / safeTotal) * 100 : 0;
      progressFillRef.current.style.width = `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`;
    }
  }, []);

  const showControls = useCallback(() => {
    if (!controlsVisibleRef.current) {
      controlsVisibleRef.current = true;
      setControlsVisible(true);
    }
  }, []);

  const scheduleAutoHide = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    showControls();
    if (videoRef.current && !videoRef.current.paused) {
      hideTimerRef.current = window.setTimeout(() => {
        controlsVisibleRef.current = false;
        setControlsVisible(false);
      }, 2200);
    }
  }, [showControls]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsPlaying(false);
    durationRef.current = asset.durationSeconds || 0;
    setDuration(asset.durationSeconds || 0);
    controlsVisibleRef.current = true;
    setControlsVisible(true);
    setErrorMessage(null);
    syncProgressDom(0, asset.durationSeconds || 0);

    if (asset.externalUrl) {
      setMediaUrl(asset.externalUrl);
      setLoadState('ready');
      return;
    }

    setLoadState('loading');
    acquireVaultObjectUrl(asset.id, productionId).then((url) => {
      if (cancelled) return;
      if (url) {
        setMediaUrl(url);
        setLoadState('ready');
      } else {
        setMediaUrl(null);
        setLoadState('missing');
      }
    });

    return () => {
      cancelled = true;
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      if (!asset.externalUrl) {
        releaseVaultObjectUrl(asset.id);
      }
    };
  }, [asset.id, asset.externalUrl, asset.durationSeconds, productionId, syncProgressDom]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el || loadState !== 'ready') return;
    if (el.paused) {
      el.playbackRate = playbackRate;
      el.play()
        .then(() => scheduleAutoHide())
        .catch((err) => {
          setLoadState('unsupported');
          setErrorMessage(
            err?.name === 'NotSupportedError'
              ? `Browser cannot natively decode "${asset.detectedContainer || asset.mimeType}".`
              : 'Unable to start video playback.'
          );
          setIsPlaying(false);
        });
    } else {
      el.pause();
      showControls();
    }
  }, [asset.detectedContainer, asset.mimeType, loadState, playbackRate, scheduleAutoHide, showControls]);

  const stepSeconds = (delta: number) => {
    const el = videoRef.current;
    if (!el || loadState !== 'ready') return;
    const maxD = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : durationRef.current;
    const next = Math.max(0, maxD > 0 ? Math.min(maxD, el.currentTime + delta) : el.currentTime + delta);
    el.currentTime = next;
    syncProgressDom(next, maxD);
    scheduleAutoHide();
  };

  const stepFrame = (dir: -1 | 1) => {
    const el = videoRef.current;
    if (!el || loadState !== 'ready') return;
    if (!el.paused) el.pause();
    stepSeconds(dir * FRAME_STEP_SECONDS);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    isSeekingRef.current = true;
    const val = Number(e.target.value);
    if (videoRef.current && Number.isFinite(val)) {
      videoRef.current.currentTime = val;
      syncProgressDom(val, durationRef.current);
    }
    window.setTimeout(() => {
      isSeekingRef.current = false;
    }, 60);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    setMuted(val === 0);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (videoRef.current) {
      videoRef.current.muted = next;
    }
  };

  const handleSpeedChange = (nextRate: number) => {
    setPlaybackRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen rejection cleanly
    }
  };

  const togglePip = async () => {
    const el = videoRef.current;
    if (!el || !supportsPip) return;
    try {
      if (document.pictureInPictureElement === el) {
        await document.exitPictureInPicture();
      } else {
        await el.requestPictureInPicture();
      }
    } catch {
      // Ignore PiP rejection cleanly
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLSelectElement) return;
    if (e.code === 'Space' || e.key.toLowerCase() === 'k') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      stepSeconds(-5);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      stepSeconds(5);
    } else if (e.key === ',') {
      e.preventDefault();
      stepFrame(-1);
    } else if (e.key === '.') {
      e.preventDefault();
      stepFrame(1);
    } else if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      toggleMute();
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      void toggleFullscreen();
    }
  };

  if (loadState === 'loading') {
    return (
      <div className="rounded-2xl border border-[#B45CFF]/20 bg-[#0B0712] px-4 py-24 flex flex-col items-center gap-2.5 text-xs text-purple-300/60">
        <Loader2 className="w-6 h-6 animate-spin text-[#B45CFF]" />
        <span>Loading video stream from Vault storage...</span>
      </div>
    );
  }

  if (loadState === 'missing' || loadState === 'unsupported' || !mediaUrl) {
    return (
      <div
        data-testid={`vault-video-unsupported-${asset.id}`}
        className="rounded-2xl border border-amber-400/25 bg-amber-950/20 p-6 space-y-3 text-xs text-amber-100"
      >
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-sm font-semibold">Video codec or container unavailable natively</div>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              {errorMessage ||
                (loadState === 'unsupported'
                  ? `Container/codec "${asset.detectedContainer || asset.mimeType}" is preserved in Vault, but this browser cannot decode it natively inline (common for ProRes MOV, DivX AVI, or HEVC MKV). Convert externally to H.264 MP4 or VP9 WebM for browser preview, or download the original.`
                  : 'Video stream unavailable in local browser storage.')}
            </p>
          </div>
        </div>
        {mediaUrl && (
          <a
            href={mediaUrl}
            download={asset.originalFilename}
            className="px-3.5 py-2 rounded-xl border border-white/15 bg-white/10 text-[#f3efe6] hover:bg-white/15 inline-flex items-center gap-1.5 text-xs font-medium"
          >
            <Download className="w-4 h-4" />
            Download Original ({asset.detectedContainer || 'Video'})
          </a>
        )}
      </div>
    );
  }

  const showOverlay = controlsVisible || !isPlaying;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={scheduleAutoHide}
      onMouseLeave={() => {
        if (videoRef.current && !videoRef.current.paused) {
          controlsVisibleRef.current = false;
          setControlsVisible(false);
        }
      }}
      data-testid={`vault-media-player-${asset.id}`}
      style={{ contain: 'layout paint' }}
      className="relative rounded-2xl border border-[#B45CFF]/25 bg-[#0B0712] overflow-hidden shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#B45CFF]/40 group"
    >
      {/* Lightweight Floating Overlay Pills (no heavy per-frame backdrop-filter blur over decoded video plane) */}
      <div
        className={`absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none transition-opacity duration-200 ${
          showOverlay ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="px-3 py-1 rounded-full bg-[#191126]/90 border border-[#B45CFF]/25 flex items-center gap-2 text-[11px] text-[#E6C2FF] max-w-[70%] shadow">
          <span className="font-mono text-[10px] text-[#D18AFF] uppercase">
            {asset.detectedContainer || 'VIDEO'}
          </span>
          <span className="truncate font-medium">{asset.name}</span>
        </div>
        <div className="px-2.5 py-1 rounded-full bg-[#191126]/90 border border-[#B45CFF]/25 text-[10px] font-mono text-purple-200/80 shrink-0 shadow">
          {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}
          {formatFileSize(asset.fileSizeBytes)}
        </div>
      </div>

      {/* Hardware-Layer Composited Aspect-Preserving Cinema Surface */}
      <div className="w-full min-h-[340px] md:min-h-[420px] bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          src={mediaUrl}
          preload="auto"
          playsInline
          disableRemotePlayback
          style={{ transform: 'translateZ(0)' }}
          onClick={togglePlay}
          onPlay={() => {
            setIsPlaying(true);
            setIsBuffering(false);
            scheduleAutoHide();
          }}
          onPause={() => {
            setIsPlaying(false);
            showControls();
          }}
          onEnded={() => {
            setIsPlaying(false);
            showControls();
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) {
              durationRef.current = d;
              setDuration(d);
              syncProgressDom(e.currentTarget.currentTime, d);
            }
            e.currentTarget.volume = volume;
            e.currentTarget.muted = muted;
            e.currentTarget.playbackRate = playbackRate;
          }}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) {
              durationRef.current = d;
              setDuration(d);
              syncProgressDom(e.currentTarget.currentTime, d);
            }
          }}
          onTimeUpdate={(e) => {
            syncProgressDom(e.currentTarget.currentTime, durationRef.current);
          }}
          onError={() => {
            setLoadState('unsupported');
            setIsPlaying(false);
            setIsBuffering(false);
            setErrorMessage(
              `This browser cannot decode "${asset.detectedContainer || asset.mimeType}" natively. Original file preserved for download.`
            );
          }}
          className="w-full max-h-[68vh] object-contain cursor-pointer block bg-black"
        />
      </div>

      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/40">
          <Loader2 className="w-8 h-8 animate-spin text-[#D18AFF]" />
        </div>
      )}

      {/* Lightweight GPU-Friendly Transport Control Deck */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`mx-3 mb-3 mt-1 rounded-2xl border border-[#B45CFF]/25 bg-[#191126]/95 px-4 py-2.5 space-y-2 shadow-2xl transition-opacity duration-200 ${
          isFullscreen ? 'absolute inset-x-0 bottom-0 z-20' : ''
        } ${
          isFullscreen && !showOverlay ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span ref={timeLabelRef} className="text-[#D18AFF] tabular-nums w-11 text-right">
            00:00
          </span>
          <div className="relative flex-1 flex items-center h-3">
            <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div
                ref={progressFillRef}
                className="h-full bg-gradient-to-r from-[#923BFF] via-[#B45CFF] to-[#D18AFF] rounded-full"
                style={{ width: '0%' }}
              />
            </div>
            <input
              ref={seekInputRef}
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.04}
              defaultValue={0}
              disabled={duration <= 0}
              onChange={handleSeek}
              aria-label="Seek video timeline"
              data-testid={`vault-player-seek-${asset.id}`}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
            />
          </div>
          <span className="text-purple-300/60 tabular-nums w-11">{formatDuration(duration)}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid={`vault-player-play-${asset.id}`}
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-[#B45CFF] via-[#923BFF] to-[#7628D9] text-white hover:brightness-110 flex items-center justify-center cursor-pointer shadow-[0_0_12px_rgba(180,92,255,0.35)] border border-[#D18AFF]/40"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => stepFrame(-1)}
              aria-label="Previous frame"
              title="Step back 1 frame (,)"
              data-testid={`vault-video-prev-frame-${asset.id}`}
              className="px-2 py-1 rounded-xl bg-white/[0.08] hover:bg-[#B45CFF]/15 border border-[#B45CFF]/20 text-[#E6C2FF] text-[10px] font-mono inline-flex items-center gap-0.5 cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
              1f
            </button>

            <button
              type="button"
              onClick={() => stepFrame(1)}
              aria-label="Next frame"
              title="Step forward 1 frame (.)"
              data-testid={`vault-video-next-frame-${asset.id}`}
              className="px-2 py-1 rounded-xl bg-white/[0.08] hover:bg-[#B45CFF]/15 border border-[#B45CFF]/20 text-[#E6C2FF] text-[10px] font-mono inline-flex items-center gap-0.5 cursor-pointer"
            >
              1f
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Video playback speed"
              data-testid={`vault-player-speed-${asset.id}`}
              value={playbackRate}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="rounded-xl bg-[#0B0712] border border-[#B45CFF]/25 px-2 py-1 text-[11px] font-mono text-[#E6C2FF] cursor-pointer"
            >
              {SPEED_OPTIONS.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute video' : 'Mute video'}
                data-testid={`vault-player-mute-${asset.id}`}
                className="p-1.5 rounded-xl bg-white/[0.08] hover:bg-[#B45CFF]/15 border border-[#B45CFF]/20 text-[#E6C2FF] cursor-pointer"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Video volume"
                data-testid={`vault-player-volume-${asset.id}`}
                className="w-16 accent-[#B45CFF] cursor-pointer h-1.5"
              />
            </div>

            {supportsPip && (
              <button
                type="button"
                onClick={() => void togglePip()}
                aria-label="Toggle Picture-in-Picture"
                title="Picture-in-Picture"
                data-testid={`vault-video-pip-${asset.id}`}
                className="p-1.5 rounded-xl bg-white/[0.08] hover:bg-[#B45CFF]/15 border border-[#B45CFF]/20 text-[#E6C2FF] cursor-pointer"
              >
                <PictureInPicture2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label="Toggle fullscreen"
              title="Fullscreen (F)"
              data-testid={`vault-video-fullscreen-${asset.id}`}
              className="p-1.5 rounded-xl bg-white/[0.08] hover:bg-[#B45CFF]/15 border border-[#B45CFF]/20 text-[#E6C2FF] cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
