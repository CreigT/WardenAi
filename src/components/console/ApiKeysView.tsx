/**
 * Warden Console: API Keys View
 * Secure API Key issuance (SHA-256 hashed on server) & Revocation
 * Creignificent LLC
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Lock,
  X,
  ShieldCheck
} from 'lucide-react';
import type { ApiKey } from '../../types';

export const ApiKeysView: React.FC = () => {
  const { currentProject, organization } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadKeys();
  }, [currentProject]);

  const loadKeys = async () => {
    try {
      const data = await api.getApiKeys();
      setApiKeys(data);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName || !currentProject) return;
    setSubmitting(true);
    try {
      const res = await api.createApiKey({
        project_id: currentProject.id,
        name: keyName,
        organization_id: organization?.id
      });
      setNewlyCreatedKey(res.rawKey);
      setApiKeys(prev => [res.apiKey, ...prev]);
      setKeyName('');
    } catch (err: any) {
      alert(err.message || 'Failed to create API key');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke API key '${name}'? Any AI agent using this key will immediately be rejected.`)) {
      return;
    }
    try {
      await api.revokeApiKey(id);
      setApiKeys(prev => prev.filter(k => k.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to revoke API key');
    }
  };

  const handleCopy = () => {
    if (newlyCreatedKey) {
      navigator.clipboard.writeText(newlyCreatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div id="warden-apikeys-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <KeyRound className="w-6 h-6 text-cyan-400" />
            API Keys
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Authenticate your AI agents and orchestrators against the Warden <code className="text-cyan-400">/api/v1/admit</code> and <code className="text-cyan-400">/api/v1/review</code> endpoints.
          </p>
        </div>

        <button
          id="create-api-key-btn"
          onClick={() => {
            setNewlyCreatedKey(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Generate API Key
        </button>
      </div>

      {/* Security Callout */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-300">
        <Lock className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold text-white">Cryptographic Storage Notice:</span> Warden hashes all API keys using SHA-256 before persistence. Raw keys are presented exactly once upon creation and cannot be retrieved later.
        </div>
      </div>

      {/* Keys Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3.5 px-4">Key Name</th>
              <th className="py-3.5 px-4">Prefix / Key Hint</th>
              <th className="py-3.5 px-4">Created</th>
              <th className="py-3.5 px-4">Last Used</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {apiKeys.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">
                  No API keys issued for this workspace yet.
                </td>
              </tr>
            ) : (
              apiKeys.map(k => (
                <tr key={k.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-white">
                    {k.name}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-cyan-400 text-xs">
                    {k.key_prefix}••••••••••••••••
                  </td>

                  <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>

                  <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleRevoke(k.id, k.name)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Revoke Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Key Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            {!newlyCreatedKey ? (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Generate Warden API Key</h3>
                    <p className="text-xs text-slate-400">Scoped to {currentProject?.name}</p>
                  </div>
                </div>

                <form onSubmit={handleCreateKey} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Key Name / Description</label>
                    <input
                      type="text"
                      required
                      value={keyName}
                      onChange={e => setKeyName(e.target.value)}
                      placeholder="e.g. LangChain AutoGPT Production Worker"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                    >
                      {submitting ? 'Generating...' : 'Generate Key'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Key Generated Successfully</h3>
                    <p className="text-xs text-slate-400">Copy your key now. It will never be shown again.</p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-cyan-300 select-all break-all">
                    {newlyCreatedKey}
                  </span>
                  <button
                    id="copy-generated-key-btn"
                    onClick={handleCopy}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg shrink-0 transition-colors"
                    title="Copy API Key"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Store this key in your agent's secure environment. Once this dialog closes, it cannot be recovered.
                  </span>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20"
                >
                  I have saved my API key
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
