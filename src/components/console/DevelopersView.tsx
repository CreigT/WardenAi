/**
 * WardenAi Console: Developer / API Quickstart View
 * SDK documentation, integration code snippets, and direct API specs
 * Creignificent LLC
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Code2,
  Terminal,
  Copy,
  Check,
  Zap,
  Layers,
  BookOpen,
  ArrowRight
} from 'lucide-react';

export const DevelopersView: React.FC = () => {
  const { currentProject } = useAuth();
  const [selectedLang, setSelectedLang] = useState<'typescript' | 'python' | 'curl' | 'langchain'>('typescript');
  const [copied, setCopied] = useState(false);

  const snippets = {
    typescript: `import { WardenAiClient } from '@warden-ai/sdk';

// Initialize with your WardenAi API Key
const warden = new WardenAiClient({
  apiKey: process.env.WARDEN_API_KEY,
  projectId: '${currentProject?.id || 'proj_default'}'
});

async function runAutonomousAgentTask(agentId: string) {
  // 1. Establish an authorized agent session
  const session = await warden.createSession({ agentId, name: 'Data Pipeline Worker' });

  // 2. Intercept before execution
  const admit = await warden.admit({
    sessionId: session.id,
    tool: 'file_read',
    action: 'load_data',
    target: '/app/data/dataset.json'
  });

  if (admit.decision !== 'ALLOW') {
    throw new Error(\`Action Denied: \${admit.reason}\`);
  }

  // 3. Perform tool execution securely
  const toolResult = await performToolExecution();

  // 4. Post-execution review (secret leak & quota scan)
  const review = await warden.review({
    sessionId: session.id,
    actionId: admit.action_id,
    toolResult
  });

  if (review.decision === 'TERMINATE') {
    await shutdownAgent(session.id);
  }
}`,

    python: `from warden_ai import WardenAiClient, WardenAiPolicyViolation

# Initialize WardenAi Control Plane Client
warden = WardenAiClient(
    api_key="wrd_live_...",
    project_id="${currentProject?.id || 'proj_default'}"
)

# 1. Start agent session
session = warden.create_session(agent_id="python_worker_v1")

# 2. Pre-execution Admission Check
admit = warden.admit(
    session_id=session.id,
    tool="file_read",
    action="read_config",
    target="/app/data/config.json"
)

if admit.decision != "ALLOW":
    raise WardenAiPolicyViolation(f"Blocked by WardenAi: {admit.reason}")

# 3. Execute approved tool
result = execute_file_read(admit.target)

# 4. Review tool output
review = warden.review(
    session_id=session.id,
    action_id=admit.action_id,
    tool_result=result
)

if review.decision == "TERMINATE":
    warden.terminate_session(session.id, reason="Policy breach detected in output")`,

    curl: `# 1. Admit Evaluation
curl -X POST /api/v1/admit \\
  -H "Authorization: Bearer wrd_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "${currentProject?.id || 'proj_default'}",
    "agent_id": "curl_agent_01",
    "tool": "file_read",
    "action": "load_document",
    "target": "/app/data/report.pdf"
  }'

# 2. Review Evaluation
curl -X POST /api/v1/review \\
  -H "Authorization: Bearer wrd_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "session_id": "sess_12345",
    "action_id": "act_67890",
    "tool_result": { "bytes": 4096, "status": "ok" }
  }'`,

    langchain: `from langchain.agents import Tool, AgentExecutor
from warden_ai.adapters.langchain import WardenAiToolGuard

# Wrap existing LangChain tools with WardenAi Zero-Trust Control
warden_guard = WardenAiToolGuard(
    api_key="wrd_live_...",
    project_id="${currentProject?.id || 'proj_default'}"
)

# Intercepts every tool invocation before reaching operating environment
safe_tools = [
    warden_guard.wrap(Tool(name="bash", func=run_bash, description="Run shell")),
    warden_guard.wrap(Tool(name="file_read", func=read_file, description="Read disk"))
]

agent_executor = AgentExecutor.from_agent_and_tools(
    agent=my_agent,
    tools=safe_tools,
    verbose=True
)`
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[selectedLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="warden-developers-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Code2 className="w-6 h-6 text-cyan-400" />
            Developer & API Quickstart
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Drop WardenAi between your AI agents and their execution environments in 4 lines of code.
          </p>
        </div>
      </div>

      {/* Integration Code Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-2">
            {(['typescript', 'python', 'curl', 'langchain'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => setSelectedLang(lang)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all ${
                  selectedLang === lang
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {lang === 'typescript' && 'TypeScript / Node'}
                {lang === 'python' && 'Python 3'}
                {lang === 'curl' && 'cURL API'}
                {lang === 'langchain' && 'LangChain / LlamaIndex'}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Snippet'}
          </button>
        </div>

        <pre className="p-6 bg-slate-950 font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed">
          {snippets[selectedLang]}
        </pre>
      </div>

      {/* API Reference Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            Endpoint: POST /api/v1/admit
          </h3>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Evaluates requested tool actions against active workspace policies before physical execution. Returns <code className="text-emerald-400">ALLOW</code> or <code className="text-red-400">DENY</code> with granular reason codes.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-xl font-mono text-[11px] text-slate-300">
            admit(sessionId, tool, action, target, arguments)
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            Endpoint: POST /api/v1/review
          </h3>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Scans tool outputs for sensitive credential leaks, regex pattern matches, and loop runaway metrics. Returns <code className="text-emerald-400">CONTINUE</code> or <code className="text-red-400">TERMINATE</code>.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-xl font-mono text-[11px] text-slate-300">
            review(sessionId, actionId, toolResult)
          </div>
        </div>
      </div>
    </div>
  );
};
