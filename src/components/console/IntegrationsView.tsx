import React, { useEffect, useState } from 'react';
import { PlugZap, ShieldCheck, Mail, CreditCard, Github, Rocket, HardDrive, CalendarDays } from 'lucide-react';
import type { IntegrationStatus } from '../../types';

const iconMap: Record<string, React.ComponentType<any>> = {
  gmail: Mail,
  stripe: CreditCard,
  github: Github,
  vercel: Rocket,
  google_drive: HardDrive,
  google_calendar: CalendarDays
};

async function requestIntegrations(): Promise<IntegrationStatus[]> {
  const token = sessionStorage.getItem('warden_token');
  const orgId = sessionStorage.getItem('warden_org_id');
  const response = await fetch('/api/v1/integrations', {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(orgId ? { 'x-organization-id': orgId } : {})
    }
  });
  if (!response.ok) throw new Error('Unable to load integrations');
  return response.json();
}

export const IntegrationsView: React.FC = () => {
  const [items, setItems] = useState<IntegrationStatus[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    requestIntegrations().then(setItems).catch(err => setError(err.message));
  }, []);

  return <div className="space-y-6">
    <div>
      <div className="text-cyan-400 text-xs font-mono uppercase tracking-widest">Credential-isolated execution</div>
      <h1 className="text-3xl font-extrabold text-white mt-1">Integrations</h1>
      <p className="text-slate-400 mt-2 max-w-3xl">Agents do not receive provider secrets. WardenAI evaluates the request, enforces review when required, and calls the provider from the trusted gateway.</p>
    </div>

    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5 flex gap-3">
      <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
      <div><div className="font-bold text-white">v1 live gateway: Gmail</div><div className="text-sm text-slate-400 mt-1">Search and read may execute after ALLOW. Send is classified as REVIEW and cannot execute until an owner/admin approves it.</div></div>
    </div>

    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map(item => {
        const Icon = iconMap[item.provider] || PlugZap;
        return <div key={item.provider} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center"><Icon className="w-5 h-5 text-cyan-400" /></div>
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full border ${item.connected ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : item.mode === 'credential_proxy' ? 'text-amber-300 border-amber-500/30 bg-amber-500/10' : 'text-slate-400 border-slate-700 bg-slate-800'}`}>{item.connected ? 'connected' : item.mode === 'credential_proxy' ? 'needs credential' : 'planned'}</span>
          </div>
          <div className="mt-4 font-bold text-white capitalize">{item.provider.replace(/_/g, ' ')}</div>
          <div className="text-xs text-slate-500 mt-1">Mode: {item.mode.replace(/_/g, ' ')}</div>
          <div className="mt-4 flex flex-wrap gap-1.5">{item.protected_actions.map(action => <span key={action} className="text-[10px] font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded px-2 py-1">{action}</span>)}</div>
        </div>;
      })}
    </div>
  </div>;
};