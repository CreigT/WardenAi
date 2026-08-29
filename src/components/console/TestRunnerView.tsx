/**
 * Warden Console: Automated Security Test Runner View
 * Real-time automated verification of all 11+ security constraints & attack scenarios
 * Creignificent LLC
 */

import React, { useState } from 'react';
import { api } from '../../api/client';
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Activity,
  AlertTriangle,
  Flame,
  Lock,
  Layers
} from 'lucide-react';
import type { TestResultItem } from '../../types';

export const TestRunnerView: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResultItem[]>([]);
  const [summary, setSummary] = useState<{ total: number; passed: number; failed: number; duration_ms: number } | null>(null);

  const handleRunTests = async () => {
    setRunning(true);
    try {
      const data = await api.runTestSuite();
      setResults(data.results);
      setSummary(data.summary);
    } catch (err: any) {
      alert(err.message || 'Failed to execute automated test suite');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div id="warden-test-runner-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            Automated Security Test Suite
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Validates all 11+ critical security boundaries against the real server-side enforcement engine.
          </p>
        </div>

        <button
          id="run-all-tests-btn"
          onClick={handleRunTests}
          disabled={running}
          className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
        >
          {running ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Running Security Test Suite...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              Execute Automated Test Suite
            </>
          )}
        </button>
      </div>

      {/* Summary KPI Banner */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Scenarios</span>
            <div className="text-2xl font-bold font-mono text-white mt-1">{summary.total}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Passed</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-5 h-5" />
              {summary.passed}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Failed</span>
            <div className={`text-2xl font-bold font-mono mt-1 flex items-center gap-1.5 ${summary.failed > 0 ? 'text-red-400' : 'text-slate-500'}`}>
              {summary.failed > 0 ? <XCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              {summary.failed}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Suite Duration</span>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-1 flex items-center gap-1.5">
              <Clock className="w-5 h-5" />
              {summary.duration_ms}ms
            </div>
          </div>
        </div>
      )}

      {/* Test Results List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-5">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Automated Security Test Matrix ({results.length} Scenarios Evaluated)
          </h3>
          <span className="text-[11px] font-mono text-slate-500">Live Server-Side Execution</span>
        </div>

        {results.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Terminal className="w-10 h-10 mx-auto mb-3 opacity-40 text-slate-400" />
            <p className="text-sm font-medium">No tests executed yet.</p>
            <p className="text-xs text-slate-600 mt-1">
              Click "Execute Automated Test Suite" above to verify all security boundaries.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((t, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition-all ${
                  t.passed
                    ? 'bg-emerald-950/20 border-emerald-900/60'
                    : 'bg-red-950/30 border-red-800/80'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {t.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-bold text-white font-mono">{t.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{t.description}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-slate-400">{t.duration_ms}ms</span>
                    <span
                      className={`text-xs font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                        t.passed
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-red-500/20 text-red-300 border-red-500/40'
                      }`}
                    >
                      {t.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                </div>

                {t.error && (
                  <div className="mt-3 p-2.5 rounded-lg bg-red-950/60 border border-red-800/80 text-xs font-mono text-red-300">
                    Error: {t.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
