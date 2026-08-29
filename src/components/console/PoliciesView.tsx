/**
 * Warden Console: Policies View
 * Visual and JSON policy engine editor for autonomous agent guardrails
 * Creignificent LLC
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Plus,
  Save,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Layers,
  Lock,
  Terminal,
  Globe,
  FileCode,
  Sliders,
  Flame,
  Check,
  X
} from 'lucide-react';
import type { Policy, PolicyRules } from '../../types';

export const PoliciesView: React.FC = () => {
  const { currentProject } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [activePolicy, setActivePolicy] = useState<Policy | null>(null);
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual');
  const [jsonText, setJsonText] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    loadPolicies();
  }, [currentProject]);

  const loadPolicies = async () => {
    try {
      const data = await api.getPolicies(currentProject?.id);
      setPolicies(data);
      if (data.length > 0) {
        setActivePolicy(data[0]);
        setJsonText(JSON.stringify(data[0].rules, null, 2));
      }
    } catch (err) {
      console.error('Failed to load policies:', err);
    }
  };

  const handleSelectPolicy = (pol: Policy) => {
    setActivePolicy(pol);
    setJsonText(JSON.stringify(pol.rules, null, 2));
  };

  const handleSave = async () => {
    if (!activePolicy) return;
    setSaving(true);
    setSavedSuccess(false);

    try {
      let rulesToSave: PolicyRules = activePolicy.rules;
      if (editMode === 'json') {
        rulesToSave = JSON.parse(jsonText);
      }

      const updated = await api.updatePolicy(activePolicy.id, {
        name: activePolicy.name,
        description: activePolicy.description,
        enabled: activePolicy.enabled,
        rules: rulesToSave
      });

      setActivePolicy(updated);
      setJsonText(JSON.stringify(updated.rules, null, 2));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      await loadPolicies();
    } catch (err: any) {
      alert(err.message || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const updateRuleField = <K extends keyof PolicyRules>(key: K, value: PolicyRules[K]) => {
    if (!activePolicy) return;
    const updatedRules: PolicyRules = {
      ...activePolicy.rules,
      [key]: value
    };
    setActivePolicy({
      ...activePolicy,
      rules: updatedRules
    });
    setJsonText(JSON.stringify(updatedRules, null, 2));
  };

  const addArrayItem = (key: 'allowed_tools' | 'blocked_tools' | 'allowed_paths' | 'blocked_paths' | 'allowed_domains' | 'blocked_domains' | 'blocked_env_vars' | 'blocked_shell_commands' | 'sensitive_data_patterns', item: string) => {
    if (!item.trim() || !activePolicy) return;
    const current = activePolicy.rules[key] || [];
    if (!current.includes(item.trim())) {
      updateRuleField(key, [...current, item.trim()]);
    }
  };

  const removeArrayItem = (key: 'allowed_tools' | 'blocked_tools' | 'allowed_paths' | 'blocked_paths' | 'allowed_domains' | 'blocked_domains' | 'blocked_env_vars' | 'blocked_shell_commands' | 'sensitive_data_patterns', item: string) => {
    if (!activePolicy) return;
    const current = activePolicy.rules[key] || [];
    updateRuleField(key, current.filter(i => i !== item));
  };

  return (
    <div id="warden-policies-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-cyan-400" />
            Security Policies
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Rules configured here are enforced server-side on every <code className="text-cyan-400">admit()</code> and <code className="text-cyan-400">review()</code> execution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-800/60">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Policy Updated (v{activePolicy?.version})
            </span>
          )}

          <button
            id="save-policy-btn"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Deploy Policy Changes'}
          </button>
        </div>
      </div>

      {/* Main Policy Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Policy List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Project Policies
          </label>
          {policies.map(p => (
            <button
              key={p.id}
              onClick={() => handleSelectPolicy(p)}
              className={`w-full p-3 rounded-xl text-left border transition-all ${
                activePolicy?.id === p.id
                  ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md shadow-cyan-500/5'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white truncate">{p.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  v{p.version}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-1">{p.description}</p>
            </button>
          ))}
        </div>

        {/* Right: Policy Rule Editor */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          {activePolicy ? (
            <div className="space-y-6">
              {/* Policy Header & Mode Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{activePolicy.name}</h2>
                    <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                      v{activePolicy.version}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{activePolicy.description}</p>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setEditMode('visual')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      editMode === 'visual' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Visual Rules
                  </button>
                  <button
                    onClick={() => {
                      setJsonText(JSON.stringify(activePolicy.rules, null, 2));
                      setEditMode('json');
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      editMode === 'json' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    JSON Config
                  </button>
                </div>
              </div>

              {editMode === 'json' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Raw Policy Rules Specification (JSON)
                  </label>
                  <textarea
                    rows={18}
                    value={jsonText}
                    onChange={e => setJsonText(e.target.value)}
                    className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl p-4 text-cyan-300 focus:outline-none focus:border-cyan-500 leading-relaxed"
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Tool Whitelist & Blacklist */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Whitelisted Tools */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Allowed Tools (Whitelist)
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {activePolicy.rules.allowed_tools?.map((tool, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs font-mono"
                          >
                            {tool}
                            <button
                              onClick={() => removeArrayItem('allowed_tools', tool)}
                              className="hover:text-red-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Add allowed tool (e.g. file_read) & press Enter"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            addArrayItem('allowed_tools', (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Blacklisted Tools */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Blocked Tools (Blacklist)
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {activePolicy.rules.blocked_tools?.map((tool, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-xs font-mono"
                          >
                            {tool}
                            <button
                              onClick={() => removeArrayItem('blocked_tools', tool)}
                              className="hover:text-red-200"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Add blocked tool (e.g. bash, shell_exec) & press Enter"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            addArrayItem('blocked_tools', (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  {/* File Path Whitelist & Blacklist */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Blocked Paths */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <label className="block text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        Blocked Paths (Glob Patterns)
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {activePolicy.rules.blocked_paths?.map((path, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-xs font-mono"
                          >
                            {path}
                            <button
                              onClick={() => removeArrayItem('blocked_paths', path)}
                              className="hover:text-red-200"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Add blocked path (e.g. .env*, /etc/*, ~/.ssh/*)"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            addArrayItem('blocked_paths', (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Allowed Paths */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5" />
                        Allowed Paths (Boundary)
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {activePolicy.rules.allowed_paths?.map((path, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs font-mono"
                          >
                            {path}
                            <button
                              onClick={() => removeArrayItem('allowed_paths', path)}
                              className="hover:text-red-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Add allowed path (e.g. /app/data/*, ./src/docs/*)"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            addArrayItem('allowed_paths', (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  {/* Network & Shell Toggles */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-amber-400" />
                          Allow Shell / Bash
                        </span>
                        <input
                          type="checkbox"
                          checked={activePolicy.rules.allow_shell}
                          onChange={e => updateRuleField('allow_shell', e.target.checked)}
                          className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        When disabled, any invocation of bash or system shells is blocked with critical risk.
                      </p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-cyan-400" />
                          Allow Env Vars Access
                        </span>
                        <input
                          type="checkbox"
                          checked={activePolicy.rules.allow_env_access}
                          onChange={e => updateRuleField('allow_env_access', e.target.checked)}
                          className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Restricts agents from reading process environment secrets or API tokens.
                      </p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-red-400" />
                          Auto-Kill on Violation
                        </span>
                        <input
                          type="checkbox"
                          checked={activePolicy.rules.auto_terminate_on_violation}
                          onChange={e => updateRuleField('auto_terminate_on_violation', e.target.checked)}
                          className="rounded bg-slate-900 border-slate-700 text-red-500 focus:ring-0"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Immediately terminates the agent session when a policy rule is breached.
                      </p>
                    </div>
                  </div>

                  {/* Quota & Failure Bounds */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Max Actions Per Session
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={activePolicy.rules.max_actions_per_session || 50}
                        onChange={e => updateRuleField('max_actions_per_session', parseInt(e.target.value, 10))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Prevents infinite loop runaway costs.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Max Failures Per Session
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={activePolicy.rules.max_failures_per_session || 3}
                        onChange={e => updateRuleField('max_failures_per_session', parseInt(e.target.value, 10))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Triggers review termination on repeated tool errors.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">No policy selected.</div>
          )}
        </div>
      </div>
    </div>
  );
};
