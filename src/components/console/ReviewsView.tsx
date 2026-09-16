import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock3 } from 'lucide-react';

type PendingReview = {
  id: string;
  session_id: string;
  agent_id: string;
  tool: string;
  action: string;
  target?: string;
  reason: string;
  risk_level: string;
  admitted_at: string;
};

function authHeaders() {
  const token = sessionStorage.getItem('warden_token');
  const orgId = sessionStorage.getItem('warden_org_id');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgId ? { 'x-organization-id': orgId } : {})
  };
}

export const ReviewsView: React.FC = () => {
  const [items, setItems] = useState<PendingReview[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const response = await fetch('/api/v1/reviews', { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to load review queue');
      setItems(await response.json());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Unable to load review queue');
    }
  };
  useEffect(() => { void load(); }, []);

  const decide = async (item: PendingReview, decision: 'APPROVE' | 'REJECT') => {
    setBusy(item.id);
    try {
      const response = await fetch(`/api/v1/reviews/${item.id}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ decision, reason: decision === 'APPROVE' ? 'Approved by human reviewer in WardenAI' : 'Rejected by human reviewer in WardenAI' })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Review decision failed');
      }
      await load();
    } catch (err: any) {
      setError(err.message || 'Review decision failed');
    } finally {
      setBusy(null);
    }
  };

  return <div className="space-y-6">
    <div><div className="text-amber-400 text-xs font-mono uppercase tracking-widest">Human approval gate</div><h1 className="text-3xl font-extrabold text-white mt-1">Reviews</h1><p className="text-slate-400 mt-2">Sensitive actions wait here. Nothing marked REVIEW can execute until an owner or admin approves it.</p></div>
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      {items.length === 0 ? <div className="p-10 text-center"><Clock3 className="w-8 h-8 text-slate-600 mx-auto mb-3"/><div className="text-slate-300 font-semibold">No pending review actions</div><div className="text-xs text-slate-500 mt-1">Privileged requests classified as REVIEW will appear here.</div></div> : items.map(item => <div key={item.id} className="p-5 border-b border-slate-800 last:border-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><div className="text-sm font-bold text-white">{item.tool}.{item.action}</div><div className="text-xs text-slate-500 font-mono mt-1">{item.id} · {item.agent_id} · {item.session_id}</div><div className="text-sm text-slate-300 mt-2">{item.reason}</div>{item.target && <div className="text-xs text-slate-500 mt-1">Target: {item.target}</div>}</div>
          <div className="flex gap-2"><button disabled={busy===item.id} onClick={()=>void decide(item,'APPROVE')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 disabled:opacity-50"><CheckCircle2 className="w-4 h-4"/>Approve</button><button disabled={busy===item.id} onClick={()=>void decide(item,'REJECT')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-300 border border-red-500/30 disabled:opacity-50"><XCircle className="w-4 h-4"/>Reject</button></div>
        </div>
      </div>)}
    </div>
  </div>;
};