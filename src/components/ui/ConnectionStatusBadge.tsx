/**
 * SceneOS — Connection Status Badge
 * Renders live backend connectivity status in the app header:
 * - 🟡 Mock Mode (Offline Development)
 * - 🟢 Live Connected (Supabase PostgreSQL)
 * - 🔴 Connection Error / Unreachable
 */

import React from 'react';
import { Database, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { services } from '../../services';
import { ConnectionHealth } from '../../services/contracts/types';

export function ConnectionStatusBadge() {
  const [health, setHealth] = React.useState<ConnectionHealth>({
    state: 'connecting',
    provider: services.provider,
    message: 'Checking backend status...',
    lastChecked: new Date().toISOString(),
  });
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  const checkStatus = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await services.connection.checkHealth();
      setHealth(res);
    } catch (err: any) {
      setHealth({
        state: 'error',
        provider: services.provider,
        message: err.message || 'Failed to query backend health.',
        lastChecked: new Date().toISOString(),
      });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    checkStatus();
    // Poll health every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const getBadgeStyle = () => {
    switch (health.state) {
      case 'mock':
        return {
          bg: 'bg-amber-950/60 border-amber-500/40 text-amber-300',
          dot: 'bg-amber-400',
          label: 'Mock Mode (Offline)',
          icon: AlertTriangle,
        };
      case 'connected':
        return {
          bg: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300',
          dot: 'bg-emerald-400 animate-pulse',
          label: 'Live (Supabase)',
          icon: CheckCircle2,
        };
      case 'error':
      case 'disconnected':
        return {
          bg: 'bg-rose-950/60 border-rose-500/40 text-rose-300',
          dot: 'bg-rose-500',
          label: 'Connection Error',
          icon: ShieldAlert,
        };
      default:
        return {
          bg: 'bg-slate-900 border-slate-700 text-slate-400',
          dot: 'bg-slate-400',
          label: 'Checking...',
          icon: Database,
        };
    }
  };

  const current = getBadgeStyle();
  const Icon = current.icon;

  return (
    <div className="relative inline-block text-left text-xs font-mono">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all ${current.bg} hover:brightness-110`}
        title="Click to view backend connection telemetry"
      >
        <span className={`w-2 h-2 rounded-full ${current.dot}`} />
        <span className="font-medium tracking-tight">{current.label}</span>
        {health.latencyMs !== undefined && (
          <span className="text-[10px] opacity-70">({health.latencyMs}ms)</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-slate-900/95 border border-slate-700/80 p-4 shadow-2xl backdrop-blur-md z-50 text-slate-200">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 font-semibold">
              <Icon className="w-4 h-4 text-slate-300" />
              <span>Backend Telemetry</span>
            </div>
            <button
              onClick={checkStatus}
              disabled={isRefreshing}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-50"
              title="Refresh Health"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between py-0.5">
              <span className="text-slate-400">Provider:</span>
              <span className="font-semibold uppercase tracking-wider text-cyan-400">
                {health.provider}
              </span>
            </div>

            <div className="flex justify-between py-0.5">
              <span className="text-slate-400">Connection State:</span>
              <span className="font-medium">{health.state}</span>
            </div>

            {health.latencyMs !== undefined && (
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Ping Latency:</span>
                <span className="text-emerald-400 font-medium">{health.latencyMs} ms</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-slate-400 block mb-1">Status Message:</span>
              <p className="p-2 rounded bg-slate-950/70 border border-slate-800/60 text-slate-300 leading-relaxed font-sans text-xs">
                {health.message}
              </p>
            </div>

            {health.state === 'mock' && (
              <div className="p-2 mt-2 rounded bg-amber-950/30 border border-amber-800/30 text-amber-200 text-[10px] leading-normal font-sans">
                <strong>Notice:</strong> Changes made in mock mode stay in local memory only. To connect live Supabase, configure <code>VITE_DATA_PROVIDER=supabase</code> in <code>.env</code>.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
