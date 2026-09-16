import React, { useEffect, useState } from 'react';
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';

type CredentialStatus = {
  provider: string;
  configured: boolean;
  secret_exposed: boolean;
  storage: string;
  access: string;
};

async function requestCredentials(): Promise<CredentialStatus[]> {
  const token = sessionStorage.getItem('warden_token');
  const orgId = sessionStorage.getItem('warden_org_id');
  const response = await fetch('/api/v1/credentials', {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(orgId ? { 'x-organization-id': orgId } : {})
    }
  });
  if (!response.ok) throw new Error(response.status === 403 ? 'Owner/admin access required.' : 'Unable to load credential status.');
  return response.json();
}

export const CredentialsView: React.FC = () => {
  const [items, setItems] = useState<CredentialStatus[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    requestCredentials().then(setItems).catch(err => setError(err.message));
  }, []);

  return <div className="space-y-6">
    <div>
      <div className="text-violet-400 text-xs font-mono uppercase tracking-widest">Secret boundary</div>
      <h1 className="text-3xl font-extrabold text-white mt-1">Credentials</h1>
      <p className="text-slate-400 mt-2 max-w-3xl">Production credentials stay inside WardenAI. This screen intentionally shows status and ownership only — never raw secret values.</p>
    </div>

    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 flex gap-3">
      <LockKeyhole className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
      <div><div className="font-bold text-white">Non-exportable by design</div><div className="text-sm text-slate-400 mt-1">Agents can request a privileged action, but no endpoint returns the upstream Gmail, Stripe, JWT, or future provider secret.</div></div>
    </div>

    {error && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{error}</div>}

    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      {items.map(item => <div key={item.provider} className="p-5 border-b border-slate-800 last:border-0 grid sm:grid-cols-[1fr_auto] gap-4 items-center">
        <div className="flex gap-3 items-start">
          <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center"><KeyRound className="w-5 h-5 text-violet-400"/></div>
          <div><div className="font-bold text-white uppercase text-sm">{item.provider}</div><div className="text-xs text-slate-500 mt-1">{item.storage} · {item.access}</div></div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`px-2 py-1 rounded-full border ${item.configured ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{item.configured ? 'configured' : 'not configured'}</span>
          <span className="inline-flex items-center gap-1 text-cyan-300"><ShieldCheck className="w-4 h-4"/>secret hidden</span>
        </div>
      </div>)}
    </div>
  </div>;
};