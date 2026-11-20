import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Disc3,
  Download,
  Loader2,
  Pause,
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

const RIBBON_POINTS = 64;
const BAR_COUNT = 48;
const CANVAS_W = 880;
const CANVAS_H = 380;

interface VisualizerCache {
  width: number;
  height: number;
  xCoords: Float32Array;
  envelopeLUT: Float32Array;
  barBinLUT: Uint16Array;
  ptY: Float32Array;
  barGrad: CanvasGradient | null;
  ribbonStrokes: Array<CanvasGradient | null>;
  ribbonFills: Array<CanvasGradient | null>;
  auraIdle: CanvasGradient | null;
}

interface VaultAudioPlayerProps {
  asset: VaultAssetRecord;
  productionId: string;
}

export const VaultAudioPlayer: React.FC<VaultAudioPlayerProps> = ({
  asset,
  productionId,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const seekInputRef = useRef<HTMLInputElement | null>(null);
  const currentTimeSpanRef = useRef<HTMLSpanElement | null>(null);
  const progressFillRef = useRef<HTMLDivElement | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const freqBinsRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const timeBinsRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const smoothedBandsRef = useRef<{ bass: number; mid: number; high: number }>({
    bass: 0,
    mid: 0,
    high: 0,
  });
  const phaseRef = useRef<number>(0);
  const durationRef = useRef<number>(asset.durationSeconds || 0);
  const isSeekingRef = useRef<boolean>(false);
  const visCacheRef = useRef<VisualizerCache | null>(null);

  const [mediaUrl, setMediaUrl] = useState<string | null>(asset.externalUrl || null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'unsupported'>(
    asset.externalUrl ? 'ready' : 'loading'
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(asset.durationSeconds || 0);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analyserActive, setAnalyserActive] = useState(false);

  // Sync imperative progress bar & timecode directly (zero React re-renders during playback)
  const syncProgressDom = useCallback((timeVal: number, totalVal: number) => {
    const safeTotal = totalVal > 0 ? totalVal : 0;
    const clamped = safeTotal > 0 ? Math.max(0, Math.min(safeTotal, timeVal)) : 0;
    if (currentTimeSpanRef.current) {
      currentTimeSpanRef.current.textContent = formatDuration(clamped);
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

  const stopVisualizerLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const ensureVisualizerCache = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number): VisualizerCache => {
      const existing = visCacheRef.current;
      if (existing && existing.width === w && existing.height === h) {
        return existing;
      }

      const midY = h * 0.45;
      const xCoords = new Float32Array(RIBBON_POINTS + 1);
      const envelopeLUT = new Float32Array(RIBBON_POINTS + 1);
      for (let i = 0; i <= RIBBON_POINTS; i++) {
        const norm = i / RIBBON_POINTS;
        xCoords[i] = norm * w;
        envelopeLUT[i] = Math.pow(Math.sin(norm * Math.PI), 1.15);
      }

      const barBinLUT = new Uint16Array(BAR_COUNT);
      for (let b = 0; b < BAR_COUNT; b++) {
        barBinLUT[b] = Math.floor(Math.pow(b / BAR_COUNT, 1.3) * 88);
      }

      const barGrad = ctx.createLinearGradient(0, h, 0, midY);
      barGrad.addColorStop(0, 'rgba(180, 92, 255, 0.28)');
      barGrad.addColorStop(0.55, 'rgba(146, 59, 255, 0.16)');
      barGrad.addColorStop(1, 'rgba(66, 21, 111, 0.02)');

      const makeGrad = (stops: Array<[number, string]>, vertical = false) => {
        const g = vertical
          ? ctx.createLinearGradient(0, midY - h * 0.34, w, midY + h * 0.34)
          : ctx.createLinearGradient(0, 0, w, 0);
        for (let i = 0; i < stops.length; i++) {
          g.addColorStop(stops[i][0], stops[i][1]);
        }
        return g;
      };

      const ribbonStrokes = [
        makeGrad([
          [0, 'rgba(118, 40, 217, 0.22)'],
          [0.35, '#923BFF'],
          [0.65, '#B45CFF'],
          [1, 'rgba(118, 40, 217, 0.22)'],
        ]),
        makeGrad([
          [0, 'rgba(180, 92, 255, 0.18)'],
          [0.3, '#7628D9'],
          [0.55, '#B45CFF'],
          [0.85, '#D18AFF'],
          [1, 'rgba(180, 92, 255, 0.18)'],
        ]),
        makeGrad([
          [0, 'rgba(230, 194, 255, 0.12)'],
          [0.35, '#E6C2FF'],
          [0.65, '#D18AFF'],
          [1, 'rgba(230, 194, 255, 0.12)'],
        ]),
      ];

      const ribbonFills = [
        makeGrad(
          [
            [0, 'rgba(66, 21, 111, 0.22)'],
            [0.5, 'rgba(118, 40, 217, 0.16)'],
            [1, 'rgba(66, 21, 111, 0.02)'],
          ],
          true
        ),
        makeGrad(
          [
            [0, 'rgba(146, 59, 255, 0.18)'],
            [0.5, 'rgba(180, 92, 255, 0.20)'],
            [1, 'rgba(66, 21, 111, 0.02)'],
          ],
          true
        ),
        makeGrad(
          [
            [0, 'rgba(209, 138, 255, 0.12)'],
            [0.5, 'rgba(230, 194, 255, 0.10)'],
            [1, 'rgba(66, 21, 111, 0.02)'],
          ],
          true
        ),
      ];

      const auraIdle = ctx.createRadialGradient(w * 0.5, midY, 12, w * 0.5, midY, w * 0.44);
      auraIdle.addColorStop(0, 'rgba(180, 92, 255, 0.18)');
      auraIdle.addColorStop(0.55, 'rgba(66, 21, 111, 0.10)');
      auraIdle.addColorStop(1, 'rgba(16, 9, 27, 0)');

      const cache: VisualizerCache = {
        width: w,
        height: h,
        xCoords,
        envelopeLUT,
        barBinLUT,
        ptY: new Float32Array(RIBBON_POINTS + 1),
        barGrad,
        ribbonStrokes,
        ribbonFills,
        auraIdle,
      };
      visCacheRef.current = cache;
      return cache;
    },
    []
  );

  /**
   * Renders one zero-allocation multi-ribbon Canvas frame driven by Web Audio AnalyserNode.
   */
  const drawVisualizerFrame = useCallback(
    (
      freqBins: Uint8Array<ArrayBuffer> | null,
      timeBins: Uint8Array<ArrayBuffer> | null,
      playing: boolean
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const midY = h * 0.45;
      const cache = ensureVisualizerCache(ctx, w, h);

      ctx.clearRect(0, 0, w, h);

      let rawBass = 0;
      let rawMid = 0;
      let rawHigh = 0;

      if (playing && freqBins && freqBins.length >= 64) {
        for (let i = 1; i <= 8; i++) rawBass += freqBins[i];
        rawBass /= 8 * 255;
        for (let i = 9; i <= 36; i++) rawMid += freqBins[i];
        rawMid /= 28 * 255;
        for (let i = 37; i <= 96; i++) rawHigh += freqBins[i];
        rawHigh /= 60 * 255;
      }

      const s = smoothedBandsRef.current;
      const alpha = playing ? 0.24 : 0.14;
      s.bass += (rawBass - s.bass) * alpha;
      s.mid += (rawMid - s.mid) * alpha;
      s.high += (rawHigh - s.high) * alpha;

      if (playing) {
        phaseRef.current += 0.032 + s.mid * 0.055;
      }

      // 1. Ambient backdrop aura (pre-cached gradient + lightweight energy pulse overlay)
      if (cache.auraIdle) {
        ctx.fillStyle = cache.auraIdle;
        ctx.fillRect(0, 0, w, h);
      }
      if (playing && s.bass > 0.01) {
        ctx.fillStyle = `rgba(180, 92, 255, ${(s.bass * 0.14).toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
      }

      // Subtle horizon line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();

      // 2. Subtle spectrum pillars anchored behind controls
      if (playing && freqBins && freqBins.length > 0 && cache.barGrad) {
        const stepX = w / BAR_COUNT;
        const barW = Math.max(2, stepX - 5);
        ctx.fillStyle = cache.barGrad;
        for (let b = 0; b < BAR_COUNT; b++) {
          const binIdx = Math.min(freqBins.length - 1, cache.barBinLUT[b]);
          const mag = freqBins[binIdx] / 255;
          const bh = Math.max(2, mag * h * 0.3);
          ctx.fillRect(b * stepX + 2, h - bh, barW, bh);
        }
      }

      // 3. Three pre-styled flowing Bezier ribbons (no object/gradient allocation)
      const ribbonDefs = [
        { energy: s.bass, scale: 1.08, cycles: 2.2, offset: 0, width: 2.2, tdWeight: 0.45 },
        { energy: s.mid, scale: 0.94, cycles: 3.6, offset: 1.85, width: 2.0, tdWeight: 0.88 },
        { energy: s.high, scale: 0.74, cycles: 5.1, offset: 3.4, width: 1.6, tdWeight: 1.02 },
      ];

      ctx.globalCompositeOperation = 'screen';
      const tdLen = timeBins ? timeBins.length : 0;
      const fbLen = freqBins ? freqBins.length : 0;

      for (let r = 0; r < ribbonDefs.length; r++) {
        const def = ribbonDefs[r];
        const phase = phaseRef.current + def.offset;

        for (let i = 0; i <= RIBBON_POINTS; i++) {
          const norm = i / RIBBON_POINTS;
          const envelope = cache.envelopeLUT[i];

          let td = 0;
          if (playing && timeBins && tdLen > 0) {
            const idx = Math.min(tdLen - 1, Math.floor(norm * (tdLen - 1)));
            td = (timeBins[idx] - 128) / 128;
          }

          let binEnergy = 0;
          if (playing && freqBins && fbLen > 0) {
            const fIdx = Math.min(fbLen - 1, Math.floor(norm * 72) + 1);
            binEnergy = freqBins[fIdx] / 255;
          }

          const harmonic =
            Math.sin(norm * Math.PI * def.cycles + phase) * 0.65 +
            Math.cos(norm * Math.PI * (def.cycles * 1.75) - phase * 0.8) * 0.35;

          const activeAmp = (0.18 + def.energy * 1.38 + binEnergy * 0.55) * def.scale * h * 0.32;
          const idleAmp = 6.5 * def.scale;

          const displacement = playing
            ? (harmonic * activeAmp + td * h * 0.18 * def.tdWeight) * envelope
            : Math.sin(norm * Math.PI * def.cycles + def.offset) * idleAmp * envelope;

          cache.ptY[i] = midY + displacement;
        }

        // Fill body
        ctx.beginPath();
        ctx.moveTo(cache.xCoords[0], midY);
        for (let i = 0; i < RIBBON_POINTS; i++) {
          const x0 = cache.xCoords[i];
          const y0 = cache.ptY[i];
          const cx = (x0 + cache.xCoords[i + 1]) * 0.5;
          const cy = (y0 + cache.ptY[i + 1]) * 0.5;
          ctx.quadraticCurveTo(x0, y0, cx, cy);
        }
        ctx.lineTo(cache.xCoords[RIBBON_POINTS], cache.ptY[RIBBON_POINTS]);
        ctx.lineTo(w, midY);
        ctx.closePath();
        if (cache.ribbonFills[r]) {
          ctx.fillStyle = cache.ribbonFills[r]!;
          ctx.fill();
        }

        // Glow crest stroke
        ctx.beginPath();
        ctx.moveTo(cache.xCoords[0], cache.ptY[0]);
        for (let i = 0; i < RIBBON_POINTS; i++) {
          const x0 = cache.xCoords[i];
          const y0 = cache.ptY[i];
          const cx = (x0 + cache.xCoords[i + 1]) * 0.5;
          const cy = (y0 + cache.ptY[i + 1]) * 0.5;
          ctx.quadraticCurveTo(x0, y0, cx, cy);
        }
        ctx.lineTo(cache.xCoords[RIBBON_POINTS], cache.ptY[RIBBON_POINTS]);
        if (cache.ribbonStrokes[r]) {
          ctx.strokeStyle = cache.ribbonStrokes[r]!;
          ctx.lineWidth = def.width;
          ctx.stroke();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
    },
    [ensureVisualizerCache]
  );

  const ensureAudioAnalyser = useCallback(() => {
    const audioEl = audioRef.current;
    if (!audioEl || typeof window === 'undefined') return null;

    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.82;
        const source = ctx.createMediaElementSource(audioEl);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        sourceNodeRef.current = source;
        freqBinsRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        timeBinsRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        setAnalyserActive(true);
      } catch {
        return null;
      }
    }

    if (audioCtxRef.current?.state === 'suspended') {
      void audioCtxRef.current.resume().catch(() => {});
    }
    return analyserRef.current;
  }, []);

  const startVisualizerLoop = useCallback(() => {
    stopVisualizerLoop();
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      drawVisualizerFrame(freqBinsRef.current, timeBinsRef.current, true);
      return;
    }

    const step = () => {
      const el = audioRef.current;
      if (!el || el.paused || el.ended || (typeof document !== 'undefined' && document.hidden)) {
        stopVisualizerLoop();
        smoothedBandsRef.current = { bass: 0, mid: 0, high: 0 };
        drawVisualizerFrame(null, null, false);
        return;
      }
      if (analyserRef.current && freqBinsRef.current && timeBinsRef.current) {
        analyserRef.current.getByteFrequencyData(freqBinsRef.current);
        analyserRef.current.getByteTimeDomainData(timeBinsRef.current);
      }
      drawVisualizerFrame(freqBinsRef.current, timeBinsRef.current, true);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  }, [drawVisualizerFrame, stopVisualizerLoop]);

  // Pause visualiser processing whenever the browser tab is hidden/inactive
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.hidden) {
        stopVisualizerLoop();
      } else if (audioRef.current && !audioRef.current.paused && !audioRef.current.ended) {
        startVisualizerLoop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [startVisualizerLoop, stopVisualizerLoop]);

  useEffect(() => {
    let cancelled = false;
    setIsPlaying(false);
    durationRef.current = asset.durationSeconds || 0;
    setDuration(asset.durationSeconds || 0);
    setErrorMessage(null);
    stopVisualizerLoop();
    syncProgressDom(0, asset.durationSeconds || 0);
    drawVisualizerFrame(null, null, false);

    if (asset.externalUrl) {
      setMediaUrl(asset.externalUrl);
      setLoadState('ready');
      return () => stopVisualizerLoop();
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
      stopVisualizerLoop();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
      if (!asset.externalUrl) {
        releaseVaultObjectUrl(asset.id);
      }
    };
  }, [
    asset.id,
    asset.externalUrl,
    asset.durationSeconds,
    productionId,
    stopVisualizerLoop,
    drawVisualizerFrame,
    syncProgressDom,
  ]);

  useEffect(() => {
    return () => {
      stopVisualizerLoop();
      try {
        sourceNodeRef.current?.disconnect();
        analyserRef.current?.disconnect();
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
          void audioCtxRef.current.close();
        }
      } catch {
        // ignore teardown errors
      }
    };
  }, [stopVisualizerLoop]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || loadState !== 'ready') return;
    if (el.paused) {
      ensureAudioAnalyser();
      el.play().catch((err) => {
        setLoadState('unsupported');
        setErrorMessage(
          err?.name === 'NotSupportedError'
            ? `This browser cannot natively decode "${asset.detectedContainer || asset.mimeType}".`
            : 'Unable to start audio playback.'
        );
        setIsPlaying(false);
        stopVisualizerLoop();
      });
    } else {
      el.pause();
    }
  }, [asset.detectedContainer, asset.mimeType, ensureAudioAnalyser, loadState, stopVisualizerLoop]);

  const seekTo = useCallback(
    (nextTime: number) => {
      const el = audioRef.current;
      if (!el || !Number.isFinite(nextTime)) return;
      const total = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : durationRef.current;
      const clamped = Math.max(0, total > 0 ? Math.min(total, nextTime) : nextTime);
      el.currentTime = clamped;
      syncProgressDom(clamped, total);
    },
    [syncProgressDom]
  );

  const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    isSeekingRef.current = true;
    const val = Number(e.target.value);
    seekTo(val);
    window.setTimeout(() => {
      isSeekingRef.current = false;
    }, 60);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    setMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (audioRef.current) {
      audioRef.current.muted = next;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.code === 'Space' || e.key.toLowerCase() === 'k') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      if (audioRef.current) seekTo(audioRef.current.currentTime - 5);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      if (audioRef.current) seekTo(audioRef.current.currentTime + 5);
    } else if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      toggleMute();
    }
  };

  const trackSubtitle = useMemo(() => {
    const parts = [
      asset.detectedContainer || 'Audio',
      asset.fileSizeBytes > 0 ? formatFileSize(asset.fileSizeBytes) : null,
      asset.productionStatus,
    ].filter(Boolean);
    return parts.join(' · ');
  }, [asset.detectedContainer, asset.fileSizeBytes, asset.productionStatus]);

  if (loadState === 'loading') {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#070a12] px-4 py-24 flex flex-col items-center gap-2.5 text-xs text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-300" />
        <span>Loading audio stream from Vault storage...</span>
      </div>
    );
  }

  if (loadState === 'missing' || loadState === 'unsupported' || !mediaUrl) {
    return (
      <div
        data-testid={`vault-audio-unsupported-${asset.id}`}
        className="rounded-2xl border border-amber-400/25 bg-amber-950/20 p-6 space-y-3 text-xs text-amber-100"
      >
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-sm font-semibold">Audio codec cannot be played inline</div>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              {errorMessage ||
                (loadState === 'unsupported'
                  ? `Format "${asset.detectedContainer || asset.mimeType}" is preserved in Vault, but this browser cannot decode it natively inline (e.g. uncompressed AIFF or unsupported streams). Download the original or convert externally to WAV/MP3/AAC/OGG/Opus.`
                  : 'Audio stream unavailable in local browser storage.')}
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
            Download Original ({asset.detectedContainer || 'Audio'})
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid={`vault-media-player-${asset.id}`}
      className="relative rounded-2xl border border-[#B45CFF]/25 bg-[#10091B] min-h-[340px] sm:min-h-[390px] flex flex-col justify-between overflow-hidden shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#B45CFF]/40"
    >
      <audio
        ref={audioRef}
        src={mediaUrl}
        preload="auto"
        onPlay={() => {
          setIsPlaying(true);
          startVisualizerLoop();
        }}
        onPause={() => {
          setIsPlaying(false);
          stopVisualizerLoop();
          smoothedBandsRef.current = { bass: 0, mid: 0, high: 0 };
          drawVisualizerFrame(null, null, false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          stopVisualizerLoop();
          smoothedBandsRef.current = { bass: 0, mid: 0, high: 0 };
          drawVisualizerFrame(null, null, false);
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) {
            durationRef.current = d;
            setDuration(d);
            syncProgressDom(e.currentTarget.currentTime, d);
          }
          e.currentTarget.volume = volume;
          e.currentTarget.muted = muted;
          drawVisualizerFrame(null, null, false);
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
          stopVisualizerLoop();
          setErrorMessage(
            `Browser cannot decode "${asset.detectedContainer || asset.mimeType}" natively. Original file preserved for download.`
          );
        }}
        className="hidden"
      />

      {/* Full-Background Audio Visualiser occupying the entire player surface */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ transform: 'translateZ(0)' }}
        data-testid="vault-audio-visualizer-canvas"
        className="absolute inset-0 w-full h-full block pointer-events-none"
      />

      {/* Soft Spotify / Apple Music-style top & bottom luminance scrims keeping track info & controls crisp */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[#10091B]/80 via-transparent to-[#0B0712]/95 pointer-events-none"
      />

      {/* Top Row: Clean Apple Music / Spotify Track Identity */}
      <div className="relative z-10 px-6 pt-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl border border-[#B45CFF]/30 bg-gradient-to-br from-[#42156F] via-[#211632] to-[#10091B] flex items-center justify-center shrink-0 overflow-hidden shadow-lg">
            {asset.thumbnailDataUrl ? (
              <img
                src={asset.thumbnailDataUrl}
                alt={asset.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Disc3
                className={`w-5 h-5 text-[#D18AFF] ${isPlaying ? 'animate-pulse' : 'opacity-80'}`}
              />
            )}
          </div>
          <div className="min-w-0">
            <h3
              data-testid="vault-audio-track-title"
              className="text-base sm:text-lg font-semibold text-[#f3efe6] tracking-tight truncate"
            >
              {asset.name}
            </h3>
            <p className="text-xs text-purple-200/80 truncate mt-0.5">{trackSubtitle}</p>
            {asset.description && (
              <p className="text-[11px] text-purple-300/60 truncate mt-0.5">{asset.description}</p>
            )}
          </div>
        </div>

        {isPlaying && (
          <span
            data-testid="vault-audio-playing-badge"
            className="px-2.5 py-1 rounded-full bg-[#191126]/90 border border-emerald-400/35 text-[10px] font-mono text-emerald-300 shrink-0"
          >
            {analyserActive ? 'SPECTRUM LIVE' : 'PLAYING'}
          </span>
        )}
      </div>

      {/* Bottom Dock: Essential Apple Music / Spotify Transport Controls Only (zero backdrop-filter blur over animating canvas) */}
      <div className="relative z-10 px-5 sm:px-6 pb-5 pt-16">
        <div className="rounded-2xl border border-[#B45CFF]/25 bg-gradient-to-b from-[#191126]/90 to-[#10091B]/95 px-4 sm:px-5 py-3.5 space-y-3 shadow-[0_12px_32px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(180,92,255,0.20)]">
          {/* Interactive Progress & Timebar */}
          <div className="space-y-1.5">
            <div className="relative flex items-center h-3 group">
              <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div
                  ref={progressFillRef}
                  className="h-full bg-gradient-to-r from-[#7628D9] via-[#B45CFF] to-[#D18AFF] rounded-full"
                  style={{ width: '0%' }}
                />
              </div>
              <input
                ref={seekInputRef}
                type="range"
                min={0}
                max={duration > 0 ? duration : 100}
                step={0.05}
                defaultValue={0}
                disabled={duration <= 0}
                onChange={handleSeekInput}
                aria-label="Seek timeline"
                data-testid={`vault-player-seek-${asset.id}`}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
              <span ref={currentTimeSpanRef} className="text-[#D18AFF]">
                00:00
              </span>
              <span className="text-purple-300/60">{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Essential Bottom Controls: Track Tag · Centered Play/Pause · Volume */}
          <div className="grid grid-cols-3 items-center gap-3">
            <div className="min-w-0">
              <span className="text-[11px] font-mono text-purple-300/70 truncate block">
                {asset.detectedContainer || 'AUDIO'}
              </span>
            </div>

            <div className="flex items-center justify-center">
              <button
                type="button"
                data-testid={`vault-player-play-${asset.id}`}
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause playback' : 'Play audio'}
                className="w-11 h-11 rounded-full bg-gradient-to-r from-[#B45CFF] via-[#923BFF] to-[#7628D9] text-white hover:scale-[1.04] hover:brightness-110 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_0_16px_rgba(180,92,255,0.40)] transition-transform border border-[#D18AFF]/40"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                data-testid={`vault-player-mute-${asset.id}`}
                className="p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-white/10 cursor-pointer transition"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Audio volume"
                data-testid={`vault-player-volume-${asset.id}`}
                className="w-20 sm:w-24 accent-[#B45CFF] cursor-pointer h-1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
