import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Power, ShieldCheck, Activity } from 'lucide-react';
import { api } from '../../api/client';
import type { AgentSession } from '../../types';

export const AgentsView: React.FC = () => {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try { setSessions(await api.getSessions()); } catch { setSessions([]); }
  };
  useEffect(() => { void load(); }, []);

  const agents = useMemo(() => {
    const map = new Map<string, AgentSession[]>();
    sessions.forEach(s => map.set(s.agent_id || 'unidentified-agent', [...(map.get(s.agent_id || 'unidentified-agent') || []), s]));
    return [...map.entries()].map(([id, items]) => ({ id, sessions: items, active: items.filter(s => s.status === 'active').length }));
  }, [sessions]);

  const kill = async (agentId: string) => {
    setBusy(agentId);
    try {
      await Promise.all(sessions.filter(s => s.agent_id === agentId && s.status === 'active').map(s => api.terminateSession(s.id, `Agent ${agentId} disabled from WardenAI kill switch`)));
      await load();
    } finally { setBusy(null); }
  };

  return <div className="space-y-6">
    <div><div className="text-cyan-400 text-xs font-mono uppercase tracking-widest">Identity & control</div><h1 className="text-3xl font-extrabold text-white mt-1">Agents</h1><p className="text-slate-400 mt-2">Every autonomous agent must identify itself to WardenAI before privileged execution.</p></div>
    <div className="grid md:grid-cols-3 gap-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><Bot className="w-5 h-5 text-cyan-400"/><div className="text-2xl font-bold mt-3">{agents.length}</div><div className="text-xs text-slate-500">Registered / observed agents</div></div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><Activity className="w-5 h-5 text-emerald-400"/><div className="text-2xl font-bold mt-3">{sessions.filter(s=>s.status==='active').length}</div><div className="text-xs text-slate-500">Active sessions</div></div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><ShieldCheck className="w-5 h-5 text-violet-400"/><div className="text-sm font-bold mt-3">Credential isolation</div><div className="text-xs text-slate-500 mt-1">Agents request actions; secrets stay inside WardenAI.</div></div>
    </div>
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      {agents.length === 0 ? <div className="p-8 text-slate-500">No agent sessions observed yet.</div> : agents.map(a => <div key={a.id} className="p-5 border-b border-slate-800 last:border-0 flex items-center justify-between gap-4">
        <div><div className="font-mono text-sm text-white">{a.id}</div><div className="text-xs text-slate-500 mt-1">{a.sessions.length} session(s) · {a.active} active</div></div>
        <button disabled={!a.active || busy===a.id} onClick={()=>void kill(a.id)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-300 border border-red-500/30 disabled:opacity-40"><Power className="w-4 h-4"/>Kill agent</button>
      </div>)}
    </div>
  </div>;
};