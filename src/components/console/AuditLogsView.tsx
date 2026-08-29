/**
 * Warden Console: Audit Logs View
 * Immutable, append-only security audit trail with export and filtering
 * Creignificent LLC
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  FileCheck2,
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  Download,
  Filter,
  RefreshCw,
  Search,
  Code,
  X,
  Radio
} from 'lucide-react';
import type { AuditLog } from '../../types';

export const AuditLogsView: React.FC = () => {
  const { currentProject } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDecision, setFilterDecision] = useState<string>('');
  const [filterEventType, setFilterEventType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [currentProject, filterDecision, filterEventType]);

  const loadLogs = async () => {
    try {
      const data = await api.getAuditLogs({
        project_id: currentProject?.id,
        decision: filterDecision || undefined,
        event_type: filterEventType || undefined,
        limit: 100
      });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `wardenai_audit_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Event Type', 'Decision', 'Risk Level', 'Actor', 'Reason', 'Session ID'];
    const rows = logs.map(l => [
      l.timestamp,
      l.event_type,
      l.decision || 'N/A',
      l.risk_level || 'N/A',
      l.actor_id || 'system',
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      l.session_id || 'N/A'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `warden_audit_export_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredLogs = logs.filter(l =>
    (l.reason && l.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
    l.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.session_id && l.session_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div id="warden-audit-logs-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FileCheck2 className="w-6 h-6 text-cyan-400" />
            Audit Logs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Tamper-evident, append-only chronological ledger of all policy admissions, reviews, and security mutations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            id="export-json-btn"
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
          >
            <Code className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search audit trail by reason, event, session..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div>
          <select
            value={filterDecision}
            onChange={e => setFilterDecision(e.target.value)}
            className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Decisions (ALLOW / DENY / TERMINATE)</option>
            <option value="ALLOW">ALLOW Only</option>
            <option value="DENY">DENY Only</option>
            <option value="TERMINATE">TERMINATE Only</option>
          </select>
        </div>

        <div>
          <select
            value={filterEventType}
            onChange={e => setFilterEventType(e.target.value)}
            className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Event Types</option>
            <option value="ADMIT_EVALUATION">ADMIT_EVALUATION</option>
            <option value="REVIEW_EVALUATION">REVIEW_EVALUATION</option>
            <option value="SESSION_TERMINATED">SESSION_TERMINATED</option>
            <option value="POLICY_UPDATED">POLICY_UPDATED</option>
            <option value="API_KEY_CREATED">API_KEY_CREATED</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Reason / Rule</th>
                <th className="py-3 px-4">Session / Actor</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No matching audit logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(l => (
                  <tr
                    key={l.id}
                    onClick={() => setSelectedLog(l)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}{' '}
                      <span className="text-[10px] text-slate-600 block">
                        {new Date(l.timestamp).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {l.decision ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase border ${
                            l.decision === 'ALLOW'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : l.decision === 'DENY'
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : 'bg-red-950 text-red-300 border-red-700'
                          }`}
                        >
                          {l.decision === 'ALLOW' && <ShieldCheck className="w-3 h-3" />}
                          {l.decision === 'DENY' && <ShieldAlert className="w-3 h-3" />}
                          {l.decision === 'TERMINATE' && <AlertOctagon className="w-3 h-3" />}
                          {l.decision}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-cyan-400 text-[11px]">
                      {l.event_type}
                    </td>

                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                      {l.reason || '—'}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {l.session_id ? l.session_id.substring(0, 16) + '...' : l.actor_id || 'system'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className="text-xs text-cyan-400 font-semibold hover:underline">
                        View JSON →
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <Radio className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white">Audit Log Entry Details</h3>
            </div>

            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-cyan-300 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed">
              {JSON.stringify(selectedLog, null, 2)}
            </pre>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
