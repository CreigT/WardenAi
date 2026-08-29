/**
 * Warden Console: Sessions View
 * Monitored AI-Agent sessions, execution telemetry, and instant Kill Switch
 * Creignificent LLC
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Cpu,
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Search,
  Eye,
  RefreshCw,
  X,
  Activity,
  Layers
} from 'lucide-react';
import type { AgentSession, AgentAction, AuditLog } from '../../types';

export const SessionsView: React.FC = () => {
  const { currentProject } = useAuth();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState<AgentSession | null>(null);
  const [sessionDetails, setSessionDetails] = useState<{ actions: AgentAction[]; audit_logs: AuditLog[] } | null>(null);
  const [killingId, setKillingId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [currentProject]);

  const loadSessions = async () => {
    try {
      const data = await api.getSessions(currentProject?.id);
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKillSwitch = async (sessionId: string) => {
    if (!confirm('KILL SWITCH CONFIRMATION: Are you sure you want to terminate this active agent session immediately? All subsequent tool requests will be rejected.')) {
      return;
    }
    setKillingId(sessionId);
    try {
      await api.terminateSession(sessionId, 'Manual Kill Switch invoked by Security Operator in Console.');
      await loadSessions();
      if (selectedSession?.id === sessionId) {
        openSessionDetails({ ...selectedSession, status: 'terminated' });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to terminate session');
    } finally {
      setKillingId(null);
    }
  };

  const openSessionDetails = async (session: AgentSession) => {
    setSelectedSession(session);
    setIsDetailsOpen(true);
    try {
      const data = await api.getSessionDetails(session.id);
      setSessionDetails({ actions: data.actions, audit_logs: data.audit_logs });
    } catch (err) {
      console.error('Failed to load session details:', err);
    }
  };

  const filtered = sessions.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.agent_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id="warden-sessions-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-cyan-400" />
            Agent Sessions
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time lifecycle tracking of all autonomous AI agents connected to the control plane.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by agent ID, name, session ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64"
            />
          </div>

          <button
            onClick={loadSessions}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
            title="Refresh sessions"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Agent & Session</th>
                <th className="py-3.5 px-4">Actions Admitted</th>
                <th className="py-3.5 px-4">Failures</th>
                <th className="py-3.5 px-4">Created / Updated</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No matching agent sessions found.
                  </td>
                </tr>
              ) : (
                filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase border ${
                          s.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : s.status === 'completed'
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            s.status === 'active'
                              ? 'bg-emerald-400 animate-pulse'
                              : s.status === 'completed'
                              ? 'bg-cyan-400'
                              : 'bg-red-400'
                          }`}
                        />
                        {s.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{s.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {s.agent_id} <span className="text-slate-600">•</span> <span className="text-slate-500">{s.id}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-200">
                      {s.action_count}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`font-mono font-bold ${
                          s.failure_count > 0 ? 'text-red-400' : 'text-slate-500'
                        }`}
                      >
                        {s.failure_count}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-[11px] text-slate-400 font-mono">
                      <div>{new Date(s.created_at).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openSessionDetails(s)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                          title="Inspect Telemetry"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {s.status === 'active' && (
                          <button
                            onClick={() => handleKillSwitch(s.id)}
                            disabled={killingId === s.id}
                            className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-300 font-bold rounded-lg transition-colors flex items-center gap-1"
                            title="Instant Kill Switch"
                          >
                            <AlertOctagon className="w-3.5 h-3.5" />
                            Kill Switch
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session Details Drawer */}
      {isDetailsOpen && selectedSession && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">{selectedSession.name}</h2>
                    <div className="text-xs font-mono text-slate-400">ID: {selectedSession.id}</div>
                  </div>
                </div>

                <button
                  onClick={() => setIsDetailsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Banner */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Status</span>
                  <span className="text-xs font-bold font-mono text-cyan-400 uppercase mt-0.5 block">
                    {selectedSession.status}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Actions</span>
                  <span className="text-xs font-bold font-mono text-white mt-0.5 block">
                    {selectedSession.action_count}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Failures</span>
                  <span className="text-xs font-bold font-mono text-red-400 mt-0.5 block">
                    {selectedSession.failure_count}
                  </span>
                </div>
              </div>

              {/* Action History Log */}
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                  Actions Executed in this Session
                </h3>

                {sessionDetails?.actions && sessionDetails.actions.length > 0 ? (
                  <div className="space-y-3">
                    {sessionDetails.actions.map(a => (
                      <div key={a.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-cyan-400">tool: {a.tool}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              a.status === 'reviewed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : a.status === 'admitted'
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {a.status}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-300">
                          action: {a.action} {a.target && `• target: ${a.target}`}
                        </div>
                        {a.tool_result && (
                          <div className="p-2 bg-slate-900 rounded font-mono text-[10px] text-slate-400 overflow-x-auto">
                            Result: {JSON.stringify(a.tool_result)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                    No actions logged for this session yet.
                  </div>
                )}
              </div>
            </div>

            {/* Kill Switch Footer in Drawer */}
            {selectedSession.status === 'active' && (
              <div className="pt-6 border-t border-slate-800 mt-6">
                <button
                  onClick={() => handleKillSwitch(selectedSession.id)}
                  className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                >
                  <AlertOctagon className="w-4 h-4" />
                  Trigger Instant Session Kill Switch
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
