/**
 * Warden Console: Settings View
 * Organization configuration, Webhook endpoints, and Security defaults
 * Creignificent LLC
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Settings,
  Building,
  Bell,
  Lock,
  Save,
  CheckCircle2,
  AlertTriangle,
  Globe
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { organization } = useAuth();
  const [orgName, setOrgName] = useState(organization?.name || 'Creignificent LLC');
  const [webhookUrl, setWebhookUrl] = useState('https://security.example.com/warden/webhook');
  const [autoKillDefault, setAutoKillDefault] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div id="warden-settings-root" className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-cyan-400" />
            Organization & Security Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Global defaults, security alert webhooks, and multi-tenant organization metadata.
          </p>
        </div>

        {saved && (
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-800/60">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Settings Saved
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Organization Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-cyan-400" />
            Organization Details
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Organization Legal Name</label>
            <input
              type="text"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="text-[11px] font-mono text-slate-500">
            Organization ID: {organization?.id || 'org_creignificent_prod'}
          </div>
        </div>

        {/* Webhooks & Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan-400" />
            SIEM & Incident Response Webhook
          </h3>
          <p className="text-xs text-slate-400">
            WardenAi sends signed JSON payloads for critical policy breaches, kill switch triggers, and secret leak detections.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Webhook Target URL</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://siem.corp.internal/hooks/warden"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Global Security Defaults */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            Zero-Trust Enforcement Defaults
          </h3>

          <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <div className="text-xs font-bold text-white">Default Auto-Termination on Breach</div>
              <div className="text-[11px] text-slate-400">Automatically trigger session kill switch when a policy violation occurs.</div>
            </div>
            <input
              type="checkbox"
              checked={autoKillDefault}
              onChange={e => setAutoKillDefault(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Save className="w-4 h-4" />
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
};
