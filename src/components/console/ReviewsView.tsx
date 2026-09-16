import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { api } from '../../api/client';
import type { AuditLog } from '../../types';

export const ReviewsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const load = async () => { try { setLogs(await api.getAuditLogs({ decision: 'REVIEW', limit: 100 })); } catch { setLogs([]); } };
  useEffect(()=>{ void load(); },[]);

  const decide = async (log: AuditLog, decision: 'CONTINUE'|'TERMINATE') => {
    if (!log.session_id || !log.action_id) return;
    try {
      await api.review({ session_id: log.session_id, action_id: log.action_id, decision, reason: decision === 'CONTINUE' ? 'Approved by human reviewer in WardenAI' : 'Rejected by human reviewer in WardenAI' } as any);
      await load();
    } catch {}
  };

  return <div className="space-y-6">
    <div><div className="text-amber-400 text-xs font-mono uppercase tracking-widest">Human approval gate</div><h1 className="text-3xl font-extrabold text-white mt-1">Reviews</h1><p className="text-slate-400 mt-2">Sensitive actions wait here. Nothing privileged should execute until a human approves it.</p></div>
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      {logs.length === 0 ? <div className="p-10 text-center"><Clock3 className="w-8 h-8 text-slate-600 mx-auto mb-3"/><div className="text-slate-300 font-semibold">No pending review events</div><div className="text-xs text-slate-500 mt-1">Actions marked REVIEW will appear here.</div></div> : logs.map(log => <div key={log.id} className="p-5 border-b border-slate-800 last:border-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><div className="text-sm font-bold text-white">{log.event_type}</div><div className="text-xs text-slate-500 font-mono mt-1">{log.action_id || 'action pending'} · {log.session_id}</div><div className="text-sm text-slate-300 mt-2">{log.reason}</div></div>
          <div className="flex gap-2"><button onClick={()=>void decide(log,'CONTINUE')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"><CheckCircle2 className="w-4 h-4"/>Approve</button><button onClick={()=>void decide(log,'TERMINATE')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-300 border border-red-500/30"><XCircle className="w-4 h-4"/>Reject</button></div>
        </div>
      </div>)}
    </div>
  </div>;
};