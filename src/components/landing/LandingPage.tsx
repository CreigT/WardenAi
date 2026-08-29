/**
 * WardenAi Production Landing Page
 * Enterprise AI-Agent Security Control Plane
 * Sponsored by Creignificent LLC
 */

import React, { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Lock,
  Cpu,
  Terminal,
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Layers,
  Flame,
  Radio,
  FileCheck2,
  Code2,
  Server,
  Globe,
  Sliders
} from 'lucide-react';
import { PlaygroundView } from '../console/PlaygroundView';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onEnterConsole: () => void;
  isAuthenticated: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenAuth,
  onEnterConsole,
  isAuthenticated
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is WardenAi and how is it different from standard AI guardrails?',
      a: 'Traditional guardrails only inspect prompt text. WardenAi is an active execution control plane that intercepts the physical tools, file paths, shell commands, and outbound network requests your AI agent attempts before and after execution.'
    },
    {
      q: 'Does WardenAi perform the agent’s work or replace the LLM?',
      a: 'No. WardenAi does not do the agent’s work. WardenAi decides whether the agent is permitted to perform that work, evaluates output for credential leaks, and triggers session termination if rogue behavior is detected.'
    },
    {
      q: 'How does WardenAi protect against path traversal and prompt injection?',
      a: 'WardenAi evaluates tool payloads server-side against normalized glob path boundaries, file blacklists (e.g. .env, /etc/*), and shell command patterns. Even if an LLM is jailbroken, its underlying tool calls are blocked at the admission gateway.'
    },
    {
      q: 'What frameworks and SDKs does WardenAi support?',
      a: 'WardenAi provides native SDKs for TypeScript/Node.js, Python 3, LangChain, LlamaIndex, AutoGPT, CrewAI, and a standard REST API for any autonomous agent architecture.'
    },
    {
      q: 'How does the Kill Switch work?',
      a: 'When an agent breaches policy or exceeds failure thresholds, WardenAi terminates the session. Subsequent admit requests from that session token are immediately rejected at the gateway.'
    }
  ];

  return (
    <div id="warden-landing-root" className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950 font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-white text-lg tracking-tight">Warden<span className="text-cyan-400">Ai</span></span>
              <span className="text-[10px] text-cyan-400 font-mono font-bold uppercase ml-2 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
                Control Plane
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#how-it-works" className="hover:text-cyan-400 transition-colors">Architecture</a>
            <a href="#playground" className="hover:text-cyan-400 transition-colors">Live Playground</a>
            <a href="#capabilities" className="hover:text-cyan-400 transition-colors">Capabilities</a>
            <a href="#developers" className="hover:text-cyan-400 transition-colors">Developers</a>
            <a href="#pricing" className="hover:text-cyan-400 transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button
                id="landing-open-console-btn"
                onClick={onEnterConsole}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
              >
                Open Security Console
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  id="landing-signin-btn"
                  onClick={() => onOpenAuth('login')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Sign In
                </button>
                <button
                  id="landing-signup-btn"
                  onClick={() => onOpenAuth('signup')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
                >
                  Get Started
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 overflow-hidden border-b border-slate-800/80">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Zero-Trust Control Plane for Autonomous AI Agents</span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-400 font-semibold">Sponsored by Creignificent LLC</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-tight">
            Security Enforcement for <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-200">Autonomous AI Agents</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Control what your agents can access, execute, and expose before the action happens. WardenAi sits between AI orchestrators and operating environments to enforce strict policy boundaries.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {isAuthenticated ? (
              <button
                onClick={onEnterConsole}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-xl shadow-cyan-500/25 transition-all"
              >
                Launch Security Console
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => onOpenAuth('signup')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-xl shadow-cyan-500/25 transition-all"
              >
                Start Free Developer Trial
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <a
              href="#playground"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm rounded-xl border border-slate-800 transition-all"
            >
              <Terminal className="w-4 h-4 text-cyan-400" />
              Try Live Playground
            </a>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-sm">
              <div className="text-2xl font-bold font-mono text-white">0ms</div>
              <div className="text-xs text-slate-400 mt-1">Direct Execution Gap</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-sm">
              <div className="text-2xl font-bold font-mono text-cyan-400">100%</div>
              <div className="text-xs text-slate-400 mt-1">Pre-Execution Interception</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-sm">
              <div className="text-2xl font-bold font-mono text-emerald-400">Zero-Trust</div>
              <div className="text-xs text-slate-400 mt-1">Multi-Tenant Isolation</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-sm">
              <div className="text-2xl font-bold font-mono text-purple-400">ISO/SOC2</div>
              <div className="text-xs text-slate-400 mt-1">Immutable Audit Ledger</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 bg-slate-950 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">
              The AI Agent Security Dilemma
            </h2>
            <h3 className="text-3xl font-bold text-white tracking-tight">
              Giving Agents Tool Access Without Control is High Risk
            </h3>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              When autonomous agents run tools with unconstrained permissions, a single prompt injection or logic flaw can lead to critical data breaches and infinite runaway loops.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 mb-4">
                <Flame className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white mb-2">Prompt Injection Attacks</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Untrusted user inputs manipulate LLM system prompts into executing arbitrary bash commands and accessing sensitive local files.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white mb-2">Secret & API Key Leaks</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Agents read environment files containing <code className="text-amber-300">.env</code> keys, database credentials, and pass tokens back to users.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4">
                <Globe className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white mb-2">Unbounded Path Traversal</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Agents escape their workspace directory using relative path tricks (<code className="text-purple-300">../../etc/shadow</code>) to access host resources.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-4">
                <Activity className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white mb-2">Runaway Execution Loops</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Recursive tool failures rack up thousands of API calls and runaway cloud infrastructure bills without human oversight.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How Warden Works Section */}
      <section id="how-it-works" className="py-20 bg-slate-900/40 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
              Architecture & Lifecycle
            </h2>
            <h3 className="text-3xl font-bold text-white tracking-tight">
              Every Attempted Action Passes Through WardenAi
            </h3>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              WardenAi establishes a strict zero-trust boundary. No tool executes until WardenAi's policy engine grants explicit admission.
            </p>
          </div>

          {/* 6 Lifecycle Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl relative">
              <span className="text-[10px] font-bold font-mono text-cyan-400 uppercase">Step 01</span>
              <h4 className="text-xs font-bold text-white mt-1">Agent Request</h4>
              <p className="text-[11px] text-slate-400 mt-1">Agent issues tool payload to WardenAi control plane.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl relative">
              <span className="text-[10px] font-bold font-mono text-cyan-400 uppercase">Step 02</span>
              <h4 className="text-xs font-bold text-white mt-1">WardenAi Admit</h4>
              <p className="text-[11px] text-slate-400 mt-1">Evaluates paths, whitelists, domains & commands.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl relative">
              <span className="text-[10px] font-bold font-mono text-cyan-400 uppercase">Step 03</span>
              <h4 className="text-xs font-bold text-white mt-1">Allow / Deny</h4>
              <p className="text-[11px] text-slate-400 mt-1">Deterministic security decision returned in ms.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl relative">
              <span className="text-[10px] font-bold font-mono text-cyan-400 uppercase">Step 04</span>
              <h4 className="text-xs font-bold text-white mt-1">Tool Execution</h4>
              <p className="text-[11px] text-slate-400 mt-1">Physical tool executes strictly only if admitted.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl relative">
              <span className="text-[10px] font-bold font-mono text-cyan-400 uppercase">Step 05</span>
              <h4 className="text-xs font-bold text-white mt-1">WardenAi Review</h4>
              <p className="text-[11px] text-slate-400 mt-1">Scans output for leaked keys & regex violations.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl relative">
              <span className="text-[10px] font-bold font-mono text-cyan-400 uppercase">Step 06</span>
              <h4 className="text-xs font-bold text-white mt-1">Audit & Terminate</h4>
              <p className="text-[11px] text-slate-400 mt-1">Appends to audit ledger or kills rogue session.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Playground Demo */}
      <section id="playground" className="py-20 bg-slate-950 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
              Interactive Testbed
            </h2>
            <h3 className="text-3xl font-bold text-white tracking-tight">
              Test Live Enforcement in the WardenAi Playground
            </h3>
            <p className="text-sm text-slate-400 mt-2">
              Observe real server-side decisions on Clean Reader and Rogue Hunter agent workflows.
            </p>
          </div>

          <PlaygroundView embedded={true} />
        </div>
      </section>

      {/* Security Capabilities Grid */}
      <section id="capabilities" className="py-20 bg-slate-900/30 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
              Capabilities
            </h2>
            <h3 className="text-3xl font-bold text-white tracking-tight">
              Comprehensive Defense-in-Depth for Agent Workloads
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <ShieldCheck className="w-6 h-6 text-cyan-400 mb-3" />
              <h4 className="text-base font-bold text-white mb-2">Tool Whitelisting & Sandboxing</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Explicitly restrict which tools each agent is allowed to invoke. Reject unapproved shell commands and system tools by default.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <Lock className="w-6 h-6 text-cyan-400 mb-3" />
              <h4 className="text-base font-bold text-white mb-2">Path Traversal & Secret Defense</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Deep path normalization prevents relative directory escapes (<code className="text-cyan-300">../</code>) and locks down <code className="text-cyan-300">.env</code> and <code className="text-cyan-300">/etc/</code> files.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <Globe className="w-6 h-6 text-cyan-400 mb-3" />
              <h4 className="text-base font-bold text-white mb-2">Outbound Domain Filtering</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Prevent data exfiltration by ensuring web scrapers and HTTP fetch tools only contact approved API domains.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <FileCheck2 className="w-6 h-6 text-cyan-400 mb-3" />
              <h4 className="text-base font-bold text-white mb-2">Output Secret Scanning (DLP)</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scans tool output payloads for exposed API keys, bearer tokens, passwords, and custom regular expression patterns.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <Activity className="w-6 h-6 text-cyan-400 mb-3" />
              <h4 className="text-base font-bold text-white mb-2">Execution Quotas & Loop Defense</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Set strict ceilings on maximum actions per session and max consecutive errors to prevent runaway infinite loops.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <Flame className="w-6 h-6 text-red-400 mb-3" />
              <h4 className="text-base font-bold text-white mb-2">Instant Session Kill Switch</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Trigger manual or automated containment. Once killed, all subsequent admission requests are rejected at the edge.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Developer Section */}
      <section id="developers" className="py-20 bg-slate-950 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
              Developer First
            </h2>
            <h3 className="text-3xl font-bold text-white tracking-tight">
              4 Lines of Code to Zero-Trust Protection
            </h3>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-3xl mx-auto overflow-hidden">
            <pre className="font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed">
{`import { WardenAiClient } from '@warden-ai/sdk';

const warden = new WardenAiClient({ apiKey: process.env.WARDEN_API_KEY });

// Intercept before tool execution
const admit = await warden.admit({
  sessionId: 'sess_prod_1',
  tool: 'file_read',
  target: '/app/data/dataset.json'
});

if (admit.decision === 'ALLOW') {
  const result = await readFile(admit.target);
  await warden.review({ sessionId: 'sess_prod_1', actionId: admit.action_id, toolResult: result });
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-slate-900/30 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
              Pricing Plans
            </h2>
            <h3 className="text-3xl font-bold text-white tracking-tight">
              Transparent, Scalable AI Security Tiers
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Developer */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <h4 className="text-lg font-bold text-white">Developer</h4>
                <div className="text-3xl font-extrabold text-white font-mono my-3">$0</div>
                <p className="text-xs text-slate-400 mb-6">Zero-trust security playground for local agents.</p>
                <div className="space-y-2 text-xs text-slate-300 mb-6">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> 10,000 action admits / mo</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> 2 Projects</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> Full Playground & Audit logs</div>
                </div>
              </div>
              <button
                onClick={() => onOpenAuth('signup')}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Get Started Free
              </button>
            </div>

            {/* Pro */}
            <div className="bg-slate-900 border border-cyan-500/80 shadow-2xl shadow-cyan-500/10 rounded-2xl p-6 flex flex-col justify-between relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-500 text-slate-950 font-bold text-[10px] uppercase tracking-wider px-3 py-0.5 rounded-full">
                Most Popular
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Pro</h4>
                <div className="text-3xl font-extrabold text-white font-mono my-3">$79 <span className="text-xs text-slate-400 font-normal">/mo</span></div>
                <p className="text-xs text-slate-400 mb-6">Production control plane for autonomous swarms.</p>
                <div className="space-y-2 text-xs text-slate-300 mb-6">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> 250,000 action admits / mo</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> 10 Agent Projects</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> Automated Kill Switch triggers</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> Team RBAC Access Control</div>
                </div>
              </div>
              <button
                onClick={() => onOpenAuth('signup')}
                className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20"
              >
                Start Pro Trial
              </button>
            </div>

            {/* Business */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <h4 className="text-lg font-bold text-white">Business</h4>
                <div className="text-3xl font-extrabold text-white font-mono my-3">$299 <span className="text-xs text-slate-400 font-normal">/mo</span></div>
                <p className="text-xs text-slate-400 mb-6">Enterprise isolation, dedicated SLA & custom DLP.</p>
                <div className="space-y-2 text-xs text-slate-300 mb-6">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> 2,000,000 action admits / mo</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> Unlimited Projects & Workspaces</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> Dedicated Creignificent Support</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> SIEM Webhook Integration</div>
                </div>
              </div>
              <button
                onClick={() => onOpenAuth('signup')}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Contact Enterprise
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-slate-950 border-b border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">FAQ</h2>
            <h3 className="text-3xl font-bold text-white tracking-tight">Frequently Asked Questions</h3>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm font-bold text-white"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openFaq === idx ? 'rotate-180 text-cyan-400' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="p-5 pt-0 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Secure Your AI Agent Workloads Today
          </h2>
          <p className="mt-4 text-sm text-slate-400 max-w-xl mx-auto">
            Get instant zero-trust control over agent tools, file paths, and credentials with Creignificent LLC's WardenAi Control Plane.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() => onOpenAuth('signup')}
              className="px-6 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl shadow-xl shadow-cyan-500/20 flex items-center gap-2"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-slate-300">Warden<span className="text-cyan-400">Ai</span></span>
            <span>— AI-Agent Security Control Plane</span>
          </div>
          <div>
            © {new Date().getFullYear()} Creignificent LLC. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
