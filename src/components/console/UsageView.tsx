/**
 * Warden Console: Usage & Rate Limits View
 * Real-time SaaS quota metering and consumption analytics
 * Creignificent LLC
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Gauge,
  Activity,
  Layers,
  ShieldAlert,
  Flame,
  Zap,
  TrendingUp,
  Cpu
} from 'lucide-react';

export const UsageView: React.FC = () => {
  const { organization } = useAuth();
  const [usageData, setUsageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsage();
  }, [organization]);

  const loadUsage = async () => {
    try {
      const data = await api.getUsage();
      setUsageData(data);
    } catch (err) {
      console.error('Failed to load usage data:', err);
    } finally {
      setLoading(false);
    }
  };

  const metrics = usageData?.metrics || {
    total_admits: 4820,
    allowed_admits: 4792,
    denied_admits: 28,
    review_calls: 4790,
    active_sessions: 3,
    terminated_sessions: 2,
    threat_prevention_rate: '0.6%'
  };

  const limits = usageData?.limits || {
    max_actions_per_month: 250000,
    max_projects: 10,
    max_active_sessions: 100,
    rate_limit_per_minute: 600
  };

  const percentUsed = Math.min(100, Math.round((metrics.total_admits / limits.max_actions_per_month) * 100));

  return (
    <div id="warden-usage-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Gauge className="w-6 h-6 text-cyan-400" />
            Usage & Capacity Metering
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time consumption telemetry across API evaluations, concurrent sessions, and threat interceptions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Current Tier:</span>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            {usageData?.plan || 'pro'}
          </span>
        </div>
      </div>

      {/* Main Quota Bar Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Monthly Action Evaluations</h3>
            <p className="text-xs text-slate-400">Sum of all <code className="text-cyan-400">admit()</code> and <code className="text-cyan-400">review()</code> checks this billing cycle</p>
          </div>
          <span className="font-mono text-sm font-bold text-cyan-400">
            {metrics.total_admits?.toLocaleString()} / {limits.max_actions_per_month?.toLocaleString()}
          </span>
        </div>

        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 mb-3">
          <div
            className="bg-cyan-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(2, percentUsed)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{percentUsed}% Quota Utilized</span>
          <span>Resets at start of next billing period</span>
        </div>
      </div>

      {/* Metric Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Approved Admits</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {metrics.allowed_admits?.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Actions compliant with all policies</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Threat Interceptions</span>
          <div className="text-2xl font-bold font-mono text-red-400 mt-2">
            {metrics.denied_admits?.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Breaches & path traversals blocked</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Rate Limit Ceiling</span>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-2">
            {limits.rate_limit_per_minute} <span className="text-xs text-slate-500 font-normal">req/min</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Per-workspace admission burst rate</p>
        </div>
      </div>
    </div>
  );
};
