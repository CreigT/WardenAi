/**
 * Warden Console: Overview View
 * Real-time Security Control Plane Telemetry & Active Threat Monitor
 * Creignificent LLC
 */

import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Zap,
  Flame,
  AlertOctagon,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Layers,
  Lock,
  Radio,
  Clock
} from 'lucide-react';
import type { AuditLog, AgentSession } from '../../types';

export const OverviewView: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { currentProject, organization } = useAuth();
  const [usage, setUsage] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [activeSessions, setActiveSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, [currentProject]);

  const loadData = async () => {
    try {
      const [u, logs, sess] = await Promise.all([
        api.getUsage(),
        api.getAuditLogs({ limit: 8 }),
        api.getSessions(currentProject?.id)
      ]);
      setUsage(u);
      setRecentLogs(logs);
      setActiveSessions(sess.filter(s => s.status === 'active'));
    } catch (err) {
      console.error('Failed to load overview telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  const metrics = usage?.metrics || {
    total_admits: 4820,
    allowed_admits: 4792,
    denied_admits: 28,
    review_calls: 4790,
    active_sessions: 3,
    terminated_sessions: 2,
    threat_prevention_rate: '0.6%'
  };

  return (
    <div id="warden-overview-root" className="space-y-6">
      {/* Top Banner / System Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              SYSTEM ACTIVE: ZERO-TRUST ENFORCEMENT LIVE
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Security Control Plane
          </h1>
          <p className="text-xs text-slate-400">
            Monitoring active AI agents in <span className="text-cyan-400 font-semibold">{currentProject?.name || 'Autonomous Agent Core'}</span> ({currentProject?.environment || 'production'})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="overview-open-playground-btn"
            onClick={() => onNavigate('playground')}
            className="flex items-center gap-2 px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            Launch Playground
          </button>
          <button
            id="overview-view-audit-btn"
            onClick={() => onNavigate('audit_logs')}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            Audit Stream
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Admits */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Total Actions Admitted</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics.total_admits?.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-2">
            <TrendingUp className="w-3 h-3" />
            <span>99.4% passed policy evaluation</span>
          </div>
        </div>

        {/* Threats Intercepted & Blocked */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Threats Intercepted</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-400 font-mono">{metrics.denied_admits?.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-2">
            Blocked path traversals & unauthorized tools
          </div>
        </div>

        {/* Active Agent Sessions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Live Agent Sessions</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics.active_sessions || activeSessions.length}</div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Continuous policy monitoring</span>
          </div>
        </div>

        {/* Terminations / Kill Switch Triggers */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Kill Switch Terminations</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">{metrics.terminated_sessions?.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-2">
            Automated & manual containment events
          </div>
        </div>
      </div>

      {/* Main Grid: Live Pipeline Graph & Active Threats Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Architecture Lifecycle Flow */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Warden Defense Control Topology
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every attempted action intercepts here before hitting operating environments.
              </p>
            </div>
            <button
              onClick={() => onNavigate('policies')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              Configure Policies
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Stage 1</span>
              <h4 className="text-xs font-bold text-white mt-1">Intercept</h4>
              <p className="text-[11px] text-slate-400 mt-1">Autonomous agent issues tool payload.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Stage 2</span>
              <h4 className="text-xs font-bold text-white mt-1">admit() Guard</h4>
              <p className="text-[11px] text-slate-400 mt-1">Rules checked: whitelist, blacklist, path bounds.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Stage 3</span>
              <h4 className="text-xs font-bold text-white mt-1">Execution</h4>
              <p className="text-[11px] text-slate-400 mt-1">Safe tools execute strictly if admitted.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Stage 4</span>
              <h4 className="text-xs font-bold text-white mt-1">review() Engine</h4>
              <p className="text-[11px] text-slate-400 mt-1">Output scanned for leaked keys & secrets.</p>
            </div>
          </div>

          {/* Active Sessions Mini-Table */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Active Monitored Sessions ({activeSessions.length})
              </h3>
              <button
                onClick={() => onNavigate('sessions')}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                View all sessions →
              </button>
            </div>

            {activeSessions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                No active sessions. Launch an agent in Playground to begin.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                {activeSessions.slice(0, 3).map(session => (
                  <div key={session.id} className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <div>
                        <div className="font-semibold text-white">{session.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{session.agent_id} • ID: {session.id}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-slate-300 text-[11px]">
                        {session.action_count} actions
                      </span>
                      <button
                        onClick={() => onNavigate('sessions')}
                        className="px-2.5 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500/10 rounded border border-red-500/20"
                      >
                        Kill Switch
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Real-time Audit Stream */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Live Audit Feed
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Real-time</span>
            </div>

            <div className="space-y-2.5">
              {recentLogs.slice(0, 6).map(log => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs flex items-start gap-2.5"
                >
                  <div className="mt-0.5 shrink-0">
                    {log.decision === 'ALLOW' ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    ) : log.decision === 'DENY' ? (
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                    ) : log.decision === 'TERMINATE' ? (
                      <AlertOctagon className="w-4 h-4 text-red-500" />
                    ) : (
                      <Activity className="w-4 h-4 text-cyan-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-cyan-400 truncate">
                        {log.event_type}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">
                      {log.reason || 'Event processed'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate('audit_logs')}
            className="w-full mt-4 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors text-center"
          >
            Open Full Audit Stream →
          </button>
        </div>
      </div>
    </div>
  );
};
