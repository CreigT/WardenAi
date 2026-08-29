/**
 * WardenAi Interactive Playground Engine
 * Real server-side enforcement simulation for Clean Reader & Rogue Hunter workers
 * Creignificent LLC
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  ShieldCheck,
  Play,
  RotateCcw,
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCode,
  Lock,
  ArrowRight,
  Flame,
  Cpu,
  RefreshCw
} from 'lucide-react';
import type { AdmitResponse, ReviewResponse, SessionStatus, Policy } from '../../types';

interface StepLog {
  step: number;
  workerName: string;
  request: {
    tool: string;
    action: string;
    target?: string;
    arguments?: any;
  };
  policyName: string;
  admitDecision?: AdmitResponse;
  toolExecutionResult?: any;
  reviewDecision?: ReviewResponse;
  sessionState: SessionStatus;
  status: 'pending' | 'running' | 'success' | 'denied' | 'terminated' | 'blocked';
  notes?: string;
}

export const PlaygroundView: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { currentProject, organization } = useAuth();
  const [activeWorker, setActiveWorker] = useState<'clean_reader' | 'rogue_hunter' | 'custom'>('clean_reader');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [sessionState, setSessionState] = useState<SessionStatus>('active');
  const [sessionId, setSessionId] = useState<string>('');

  // Custom simulator form state
  const [customTool, setCustomTool] = useState('file_read');
  const [customAction, setCustomAction] = useState('read_target_resource');
  const [customTarget, setCustomTarget] = useState('/app/data/quarterly_report.pdf');
  const [customArgs, setCustomArgs] = useState('{"encoding": "utf-8"}');

  useEffect(() => {
    loadPolicies();
  }, [currentProject]);

  const loadPolicies = async () => {
    try {
      const pols = await api.getPolicies(currentProject?.id);
      setPolicies(pols);
      if (pols.length > 0 && !selectedPolicyId) {
        setSelectedPolicyId(pols[0].id);
      }
    } catch (err) {
      console.error('Failed to load policies for playground:', err);
    }
  };

  const resetPlayground = () => {
    setIsRunning(false);
    setCurrentStepIndex(-1);
    setLogs([]);
    setSessionState('active');
    setSessionId('');
  };

  const runCleanReaderScenario = async () => {
    setIsRunning(true);
    setLogs([]);
    setCurrentStepIndex(0);

    const activePolicy = policies.find(p => p.id === selectedPolicyId) || policies[0];
    const policyName = activePolicy?.name || 'Strict Enterprise Defense Policy';

    // 1. Initialize Real Agent Session on Backend
    const newSession = await api.createSession({
      project_id: currentProject?.id,
      agent_id: 'agent_clean_reader_v1',
      name: 'Clean Reader Worker Simulation',
      metadata: { scenario: 'clean_reader', worker: 'Clean Reader' }
    });

    setSessionId(newSession.id);
    setSessionState('active');

    const step1Log: StepLog = {
      step: 1,
      workerName: 'Clean Reader',
      request: {
        tool: 'file_read',
        action: 'read_document',
        target: '/app/data/quarterly_report.pdf',
        arguments: { mode: 'read_only' }
      },
      policyName,
      sessionState: 'active',
      status: 'running',
      notes: 'Initiating admit request for whitelisted business document'
    };
    setLogs([step1Log]);

    await new Promise(r => setTimeout(r, 600));

    // 2. Call Real Backend /api/v1/admit
    const admitRes = await api.admit({
      project_id: currentProject?.id || '',
      session_id: newSession.id,
      agent_id: 'agent_clean_reader_v1',
      tool: 'file_read',
      action: 'read_document',
      target: '/app/data/quarterly_report.pdf',
      arguments: { mode: 'read_only' }
    });

    step1Log.admitDecision = admitRes;
    step1Log.status = admitRes.decision === 'ALLOW' ? 'success' : 'denied';
    step1Log.sessionState = admitRes.session_status;
    step1Log.notes = `WardenAi evaluated policy -> Decision: ${admitRes.decision} (${admitRes.reason})`;
    setLogs([step1Log]);

    if (admitRes.decision !== 'ALLOW') {
      setIsRunning(false);
      return;
    }

    setCurrentStepIndex(1);
    await new Promise(r => setTimeout(r, 700));

    // 3. Tool Execution Simulation (allowed tool execution)
    step1Log.toolExecutionResult = {
      bytes_read: 8420,
      content_sample: "WardenAi Security Control Matrix: Compliant with ISO/IEC 27001 zero-trust controls.",
      status: "execution_clean"
    };
    setLogs([{ ...step1Log }]);

    setCurrentStepIndex(2);
    await new Promise(r => setTimeout(r, 600));

    // 4. Call Real Backend /api/v1/review
    const reviewRes = await api.review({
      session_id: newSession.id,
      action_id: admitRes.action_id,
      tool_result: step1Log.toolExecutionResult
    });

    step1Log.reviewDecision = reviewRes;
    step1Log.sessionState = reviewRes.session_status;
    step1Log.notes = `WardenAi Review completed -> Decision: ${reviewRes.decision} (${reviewRes.reason})`;
    setLogs([{ ...step1Log }]);

    await new Promise(r => setTimeout(r, 500));

    // 5. Final Step: Session finishes GREEN
    setSessionState('completed');
    setIsRunning(false);
  };

  const runRogueHunterScenario = async () => {
    setIsRunning(true);
    setLogs([]);
    setCurrentStepIndex(0);

    const activePolicy = policies.find(p => p.id === selectedPolicyId) || policies[0];
    const policyName = activePolicy?.name || 'Strict Enterprise Defense Policy';

    // 1. Create real session
    const newSession = await api.createSession({
      project_id: currentProject?.id,
      agent_id: 'agent_rogue_hunter_v2',
      name: 'Rogue Hunter Worker Simulation',
      metadata: { scenario: 'rogue_hunter', worker: 'Rogue Hunter' }
    });

    setSessionId(newSession.id);
    setSessionState('active');

    // === STEP 1: Requests an allowed file ===
    const step1Log: StepLog = {
      step: 1,
      workerName: 'Rogue Hunter',
      request: {
        tool: 'file_read',
        action: 'read_public_notes',
        target: '/app/data/public_data.txt',
        arguments: {}
      },
      policyName,
      sessionState: 'active',
      status: 'running',
      notes: 'Step 1: Rogue hunter issues legitimate probe to gain trust'
    };
    setLogs([step1Log]);

    await new Promise(r => setTimeout(r, 600));

    const admit1 = await api.admit({
      project_id: currentProject?.id || '',
      session_id: newSession.id,
      agent_id: 'agent_rogue_hunter_v2',
      tool: 'file_read',
      action: 'read_public_notes',
      target: '/app/data/public_data.txt'
    });

    step1Log.admitDecision = admit1;
    step1Log.status = 'success';
    step1Log.toolExecutionResult = { text: 'Public system notes loaded.' };
    step1Log.notes = 'Step 1 Admitted: Passed path filter.';
    setLogs([step1Log]);

    await new Promise(r => setTimeout(r, 700));

    // === STEP 2: Rogue requests .env.example (PROHIBITED FILE) ===
    setCurrentStepIndex(1);
    const step2Log: StepLog = {
      step: 2,
      workerName: 'Rogue Hunter',
      request: {
        tool: 'file_read',
        action: 'read_env_secrets',
        target: '.env.example',
        arguments: { extract: 'GEMINI_API_KEY, STRIPE_SECRET_KEY' }
      },
      policyName,
      sessionState: 'active',
      status: 'running',
      notes: 'Step 2: Rogue agent attempts unauthorized access to .env.example'
    };
    setLogs([step1Log, step2Log]);

    await new Promise(r => setTimeout(r, 800));

    const admit2 = await api.admit({
      project_id: currentProject?.id || '',
      session_id: newSession.id,
      agent_id: 'agent_rogue_hunter_v2',
      tool: 'file_read',
      action: 'read_env_secrets',
      target: '.env.example',
      arguments: { extract: 'GEMINI_API_KEY, STRIPE_SECRET_KEY' }
    });

    step2Log.admitDecision = admit2;
    step2Log.status = 'denied';
    step2Log.sessionState = admit2.session_status;
    step2Log.notes = `DENIED & TERMINATED: ${admit2.reason}`;
    setSessionState(admit2.session_status);
    setLogs([step1Log, step2Log]);

    await new Promise(r => setTimeout(r, 900));

    // === STEP 3: Third Attempted Action (MUST NOT EXECUTE) ===
    setCurrentStepIndex(2);
    const step3Log: StepLog = {
      step: 3,
      workerName: 'Rogue Hunter',
      request: {
        tool: 'file_read',
        action: 'probe_fallback_target',
        target: '/app/data/public_data.txt',
        arguments: {}
      },
      policyName,
      sessionState: 'terminated',
      status: 'blocked',
      notes: 'Step 3: Rogue attempts 3rd action after kill switch trigger...'
    };
    setLogs([step1Log, step2Log, step3Log]);

    await new Promise(r => setTimeout(r, 700));

    // Call admit on terminated session to prove real server-side rejection
    const admit3 = await api.admit({
      project_id: currentProject?.id || '',
      session_id: newSession.id,
      agent_id: 'agent_rogue_hunter_v2',
      tool: 'file_read',
      action: 'probe_fallback_target',
      target: '/app/data/public_data.txt'
    });

    step3Log.admitDecision = admit3;
    step3Log.status = 'blocked';
    step3Log.notes = `BLOCKED AT GATEWAY: ${admit3.reason}`;
    setLogs([step1Log, step2Log, step3Log]);

    setIsRunning(false);
  };

  const runCustomSimulation = async () => {
    setIsRunning(true);
    setLogs([]);
    setCurrentStepIndex(0);

    const activePolicy = policies.find(p => p.id === selectedPolicyId) || policies[0];
    const policyName = activePolicy?.name || 'Strict Enterprise Defense Policy';

    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(customArgs);
    } catch {
      parsedArgs = { raw: customArgs };
    }

    const newSession = await api.createSession({
      project_id: currentProject?.id,
      agent_id: 'agent_custom_worker',
      name: `Custom Simulation (${customTool})`,
      metadata: { custom: true }
    });

    setSessionId(newSession.id);
    setSessionState('active');

    const stepLog: StepLog = {
      step: 1,
      workerName: 'Custom Worker',
      request: {
        tool: customTool,
        action: customAction,
        target: customTarget,
        arguments: parsedArgs
      },
      policyName,
      sessionState: 'active',
      status: 'running',
      notes: `Evaluating ${customTool} against active policy rules...`
    };
    setLogs([stepLog]);

    await new Promise(r => setTimeout(r, 600));

    const admitRes = await api.admit({
      project_id: currentProject?.id || '',
      session_id: newSession.id,
      agent_id: 'agent_custom_worker',
      tool: customTool,
      action: customAction,
      target: customTarget,
      arguments: parsedArgs
    });

    stepLog.admitDecision = admitRes;
    stepLog.status = admitRes.decision === 'ALLOW' ? 'success' : 'denied';
    stepLog.sessionState = admitRes.session_status;
    stepLog.notes = `Decision: ${admitRes.decision} - ${admitRes.reason}`;
    setSessionState(admitRes.session_status);
    setLogs([stepLog]);

    if (admitRes.decision === 'ALLOW') {
      await new Promise(r => setTimeout(r, 600));
      stepLog.toolExecutionResult = { output: 'Tool executed successfully under WardenAi authorization.' };

      const reviewRes = await api.review({
        session_id: newSession.id,
        action_id: admitRes.action_id,
        tool_result: stepLog.toolExecutionResult
      });

      stepLog.reviewDecision = reviewRes;
      stepLog.sessionState = reviewRes.session_status;
      setSessionState(reviewRes.session_status);
      setLogs([{ ...stepLog }]);
    }

    setIsRunning(false);
  };

  return (
    <div id="warden-playground-root" className="space-y-6">
      {/* Header Banner */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Terminal className="w-6 h-6 text-cyan-400" />
              WardenAi Interactive Enforcement Playground
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Live server-side policy evaluation testbed. Observe real <code className="text-cyan-400">admit()</code> and <code className="text-cyan-400">review()</code> decisions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="playground-reset-btn"
              onClick={resetPlayground}
              disabled={isRunning}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset State
            </button>
          </div>
        </div>
      )}

      {/* Control Bar: Worker Selector & Policy Target */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scenario Selection */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Select Simulation Worker
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              id="worker-clean-reader-btn"
              onClick={() => {
                setActiveWorker('clean_reader');
                resetPlayground();
              }}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                activeWorker === 'clean_reader'
                  ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Clean Reader
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Allowed
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                Whitelisted document access, clean tool execution, review pass, finishes GREEN.
              </p>
            </button>

            <button
              id="worker-rogue-hunter-btn"
              onClick={() => {
                setActiveWorker('rogue_hunter');
                resetPlayground();
              }}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                activeWorker === 'rogue_hunter'
                  ? 'bg-red-950/40 border-red-500/50 shadow-lg shadow-red-500/5'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                  <Flame className="w-4 h-4" />
                  Rogue Hunter
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">
                  Breach & Kill
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                Allowed probe → probes <code className="text-red-300">.env.example</code> → Denied & Terminated → 3rd action BLOCKED.
              </p>
            </button>

            <button
              id="worker-custom-btn"
              onClick={() => {
                setActiveWorker('custom');
                resetPlayground();
              }}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                activeWorker === 'custom'
                  ? 'bg-cyan-950/40 border-cyan-500/50 shadow-lg shadow-cyan-500/5'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4" />
                  Custom Action
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  Interactive
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                Configure your own tool, target path, command, or arguments to test policy boundary.
              </p>
            </button>
          </div>
        </div>

        {/* Policy Selector & Run Trigger */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Active Security Policy
            </label>
            <select
              id="playground-policy-select"
              value={selectedPolicyId}
              onChange={e => setSelectedPolicyId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {policies.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (v{p.version})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-2">
              All decisions are evaluated server-side against this active policy.
            </p>
          </div>

          <button
            id="playground-run-simulation-btn"
            disabled={isRunning}
            onClick={() => {
              if (activeWorker === 'clean_reader') runCleanReaderScenario();
              else if (activeWorker === 'rogue_hunter') runRogueHunterScenario();
              else runCustomSimulation();
            }}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Evaluating on Control Plane...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Launch {activeWorker === 'clean_reader' ? 'Clean Reader' : activeWorker === 'rogue_hunter' ? 'Rogue Hunter' : 'Custom Action'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Custom Parameters Drawer if Custom Worker selected */}
      {activeWorker === 'custom' && (
        <div className="bg-slate-900/90 border border-cyan-950 rounded-2xl p-4">
          <div className="text-xs font-bold text-cyan-400 mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Custom Tool & Request Builder
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Tool Name</label>
              <input
                id="custom-tool-input"
                type="text"
                value={customTool}
                onChange={e => setCustomTool(e.target.value)}
                placeholder="file_read, bash, search_docs"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Action</label>
              <input
                id="custom-action-input"
                type="text"
                value={customAction}
                onChange={e => setCustomAction(e.target.value)}
                placeholder="read_file, execute_bash"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Target / File Path / Domain</label>
              <input
                id="custom-target-input"
                type="text"
                value={customTarget}
                onChange={e => setCustomTarget(e.target.value)}
                placeholder="/app/data/file.txt, .env.example, bash"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200"
              />
            </div>
          </div>
        </div>
      )}

      {/* Live Pipeline Flow & Decision Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Enforcement Pipeline Trace
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Session State:</span>
            <span
              id="playground-session-badge"
              className={`text-xs font-mono font-bold uppercase px-2.5 py-1 rounded-full border ${
                sessionState === 'active'
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  : sessionState === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse'
              }`}
            >
              {sessionState}
            </span>
          </div>
        </div>

        {/* Pipeline Steps Stream */}
        {logs.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Terminal className="w-10 h-10 mx-auto mb-3 opacity-40 text-slate-400" />
            <p className="text-sm font-medium">Ready to simulate AI Agent requests.</p>
            <p className="text-xs text-slate-600 mt-1">
              Select a scenario above and click "Launch" to trace real policy enforcement.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-2xl border transition-all ${
                  log.status === 'success'
                    ? 'bg-emerald-950/20 border-emerald-900/60'
                    : log.status === 'denied'
                    ? 'bg-red-950/30 border-red-800/80 shadow-lg shadow-red-950/20'
                    : log.status === 'blocked'
                    ? 'bg-purple-950/30 border-purple-800/80'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                {/* Step Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800/60">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-mono font-bold">
                      {log.step}
                    </span>
                    <span className="text-xs font-bold text-white font-mono">
                      {log.workerName}
                    </span>
                    <span className="text-slate-500 text-xs font-mono">→</span>
                    <span className="text-xs font-mono text-cyan-400">
                      tool: {log.request.tool}
                    </span>
                    {log.request.target && (
                      <span className="text-xs font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded">
                        target: {log.request.target}
                      </span>
                    )}
                  </div>

                  {/* Decision Tag */}
                  {log.admitDecision && (
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                          log.admitDecision.decision === 'ALLOW'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-red-500/20 text-red-300 border-red-500/40'
                        }`}
                      >
                        {log.admitDecision.decision}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        Risk: {log.admitDecision.risk_level}
                      </span>
                    </div>
                  )}
                </div>

                {/* 6 Required Pillars Grid: REQUEST, POLICY, DECISION, REASON, REVIEW, SESSION STATE */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  {/* 1. REQUEST */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      1. Request
                    </span>
                    <div className="font-mono text-slate-200 truncate">
                      {log.request.action}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                      {log.request.target || 'no target'}
                    </div>
                  </div>

                  {/* 2. POLICY */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      2. Policy
                    </span>
                    <div className="font-semibold text-slate-300 truncate">
                      {log.policyName}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {log.admitDecision?.rule_id || 'rule_evaluating'}
                    </div>
                  </div>

                  {/* 3. DECISION */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      3. Decision
                    </span>
                    {log.admitDecision ? (
                      <div
                        className={`font-mono font-bold ${
                          log.admitDecision.decision === 'ALLOW' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {log.admitDecision.decision}
                      </div>
                    ) : (
                      <div className="text-slate-500 font-mono">Evaluating...</div>
                    )}
                  </div>

                  {/* 4. REASON */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/60 lg:col-span-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      4. Reason
                    </span>
                    <div className="text-[11px] text-slate-300 line-clamp-2 leading-tight">
                      {log.admitDecision?.reason || log.notes || 'In progress...'}
                    </div>
                  </div>

                  {/* 5. REVIEW */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      5. Review
                    </span>
                    {log.reviewDecision ? (
                      <div className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {log.reviewDecision.decision}
                      </div>
                    ) : log.status === 'denied' || log.status === 'blocked' ? (
                      <div className="text-slate-500 text-[11px]">N/A (Execution Denied)</div>
                    ) : (
                      <div className="text-slate-500 font-mono">Pending tool output</div>
                    )}
                  </div>

                  {/* 6. SESSION STATE */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      6. Session State
                    </span>
                    <div
                      className={`font-mono font-bold uppercase ${
                        log.sessionState === 'active'
                          ? 'text-cyan-400'
                          : log.sessionState === 'completed'
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}
                    >
                      {log.sessionState}
                    </div>
                  </div>
                </div>

                {/* Additional Tool Output Detail if Allowed */}
                {log.toolExecutionResult && (
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono text-[11px] text-slate-400">
                    <span className="text-cyan-400 font-semibold">Tool Output Result: </span>
                    {JSON.stringify(log.toolExecutionResult)}
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
