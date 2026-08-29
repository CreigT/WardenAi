/**
 * Warden Server-side Policy Evaluation Engine
 * Evaluates Admit requests and Review results against Project Policies
 * Creignificent LLC
 */

import type {
  Policy,
  PolicyRules,
  AgentSession,
  AdmitRequest,
  ReviewRequest,
  Decision,
  ReviewDecision,
  RiskLevel
} from '../src/types';

export interface AdmitEvaluationResult {
  decision: Decision;
  reason: string;
  policy_id: string;
  rule_id: string;
  risk_level: RiskLevel;
  should_terminate_session: boolean;
  termination_reason?: string;
}

export interface ReviewEvaluationResult {
  decision: ReviewDecision;
  reason: string;
  risk_level: RiskLevel;
  should_terminate_session: boolean;
  termination_reason?: string;
}

/**
 * Matches simple glob patterns (e.g. *.env*, /app/data/*, .env*)
 */
function matchPattern(value: string, pattern: string): boolean {
  if (!value || !pattern) return false;
  const cleanVal = value.trim().toLowerCase();
  const cleanPat = pattern.trim().toLowerCase();

  if (cleanPat === '*' || cleanPat === '**') return true;

  // Convert glob to regex
  const regexString = '^' + cleanPat
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex special chars except * and ?
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.') + '$';

  try {
    const reg = new RegExp(regexString, 'i');
    if (reg.test(cleanVal)) return true;
  } catch {
    // Fallback simple substring / wildcard check
  }

  // Common security substring fallbacks
  if (cleanPat.startsWith('*') && cleanPat.endsWith('*')) {
    const inner = cleanPat.slice(1, -1);
    return cleanVal.includes(inner);
  }
  if (cleanPat.startsWith('*')) {
    return cleanVal.endsWith(cleanPat.slice(1));
  }
  if (cleanPat.endsWith('*')) {
    return cleanVal.startsWith(cleanPat.slice(0, -1));
  }

  return cleanVal === cleanPat || cleanVal.includes(cleanPat);
}

/**
 * Normalizes and checks for path traversal tricks
 */
function isPathSuspicious(rawPath: string): boolean {
  if (!rawPath) return false;
  const p = rawPath.replace(/\\/g, '/').toLowerCase();
  return (
    p.includes('../') ||
    p.includes('..') ||
    p.includes('%2e%2e') ||
    p.includes('~/.ssh') ||
    p.includes('/etc/passwd') ||
    p.includes('/etc/shadow') ||
    p.includes('.env')
  );
}

export function evaluateAdmit(
  req: AdmitRequest,
  policy: Policy,
  session: AgentSession
): AdmitEvaluationResult {
  const policyId = policy?.id || 'pol_default';

  // 1. Kill Switch / Terminated Session Check
  if (session.status === 'terminated') {
    return {
      decision: 'DENY',
      reason: `Session ${session.id} is TERMINATED (${session.termination_reason || 'Kill switch activated'}). No further actions permitted.`,
      policy_id: policyId,
      rule_id: 'rule_kill_switch_active',
      risk_level: 'critical',
      should_terminate_session: false // already terminated
    };
  }

  if (session.status === 'completed' || session.status === 'failed') {
    return {
      decision: 'DENY',
      reason: `Session ${session.id} is in status '${session.status}'. Cannot execute new actions.`,
      policy_id: policyId,
      rule_id: 'rule_session_inactive',
      risk_level: 'medium',
      should_terminate_session: false
    };
  }

  const rules = policy.rules;

  // 2. Max Actions Per Session Check
  if (rules.max_actions_per_session && session.action_count >= rules.max_actions_per_session) {
    const terminate = rules.auto_terminate_on_violation ?? true;
    return {
      decision: 'DENY',
      reason: `Session action limit exceeded (max: ${rules.max_actions_per_session}, current: ${session.action_count}).`,
      policy_id: policyId,
      rule_id: 'rule_max_actions_exceeded',
      risk_level: 'high',
      should_terminate_session: terminate,
      termination_reason: 'Action quota exceeded for this session'
    };
  }

  const tool = (req.tool || '').toLowerCase().trim();
  const action = (req.action || '').toLowerCase().trim();
  const target = (req.target || '').trim();
  const args = req.arguments || {};
  const argsString = JSON.stringify(args);

  // 3. Blocked Tools Check
  if (rules.blocked_tools && rules.blocked_tools.length > 0) {
    for (const blocked of rules.blocked_tools) {
      if (matchPattern(tool, blocked)) {
        const terminate = rules.auto_terminate_on_violation ?? true;
        return {
          decision: 'DENY',
          reason: `Tool '${req.tool}' is explicitly blocked by policy rule: blocked_tools [${blocked}].`,
          policy_id: policyId,
          rule_id: 'rule_blocked_tool',
          risk_level: 'critical',
          should_terminate_session: terminate,
          termination_reason: `Attempted to invoke blocked tool: ${req.tool}`
        };
      }
    }
  }

  // 4. Allowed Tools Whitelist Check
  if (rules.allowed_tools && rules.allowed_tools.length > 0) {
    const isAllowed = rules.allowed_tools.some(allowed => matchPattern(tool, allowed));
    if (!isAllowed) {
      const terminate = rules.auto_terminate_on_violation ?? false;
      return {
        decision: 'DENY',
        reason: `Tool '${req.tool}' is not in the whitelist of permitted tools for project policy.`,
        policy_id: policyId,
        rule_id: 'rule_allowed_tools_whitelist',
        risk_level: 'high',
        should_terminate_session: terminate,
        termination_reason: `Invoked unlisted tool: ${req.tool}`
      };
    }
  }

  // 5. Shell & System Command Guardrails
  if (!rules.allow_shell) {
    const isShellTool = ['bash', 'sh', 'shell', 'exec', 'system', 'terminal', 'powershell', 'cmd'].includes(tool);
    const hasShellAction = action.includes('shell') || action.includes('exec_command') || action.includes('bash');
    if (isShellTool || hasShellAction) {
      return {
        decision: 'DENY',
        reason: 'Shell execution is strictly disabled by policy (allow_shell = false).',
        policy_id: policyId,
        rule_id: 'rule_shell_disabled',
        risk_level: 'critical',
        should_terminate_session: rules.auto_terminate_on_violation ?? true,
        termination_reason: 'Unauthorized shell execution attempt'
      };
    }
  }

  // Check blocked shell commands if tool is command-oriented
  if (rules.blocked_shell_commands && rules.blocked_shell_commands.length > 0) {
    const commandToTest = (args.command || args.cmd || target || '').toLowerCase();
    for (const blockedCmd of rules.blocked_shell_commands) {
      if (commandToTest.includes(blockedCmd.toLowerCase())) {
        return {
          decision: 'DENY',
          reason: `Shell command contains prohibited instruction: '${blockedCmd}'.`,
          policy_id: policyId,
          rule_id: 'rule_blocked_shell_command',
          risk_level: 'critical',
          should_terminate_session: rules.auto_terminate_on_violation ?? true,
          termination_reason: `Prohibited shell command: ${blockedCmd}`
        };
      }
    }
  }

  // 6. Environment Variable Access Guardrails
  if (!rules.allow_env_access) {
    const isEnvTool = tool.includes('env') || action.includes('get_env') || action.includes('read_env');
    const varName = (args.var || args.variable || args.name || target || '').toUpperCase();
    if (isEnvTool || (varName && rules.blocked_env_vars?.includes(varName))) {
      return {
        decision: 'DENY',
        reason: `Environment variable access denied by policy. Access to '${varName || 'env'}' is restricted.`,
        policy_id: policyId,
        rule_id: 'rule_env_access_blocked',
        risk_level: 'high',
        should_terminate_session: rules.auto_terminate_on_violation ?? true,
        termination_reason: `Attempted unauthorized environment variable extraction: ${varName}`
      };
    }
  }

  // 7. File Path Restrictions (Target / Argument paths)
  const pathToCheck = target || args.path || args.filepath || args.file || '';
  if (pathToCheck) {
    // Check if target is a blocked file path
    if (rules.blocked_paths && rules.blocked_paths.length > 0) {
      for (const blocked of rules.blocked_paths) {
        if (matchPattern(pathToCheck, blocked) || (blocked.includes('.env') && isPathSuspicious(pathToCheck))) {
          const terminate = rules.auto_terminate_on_violation ?? true;
          return {
            decision: 'DENY',
            reason: `Target path '${pathToCheck}' violates policy path restriction: blocked_paths [${blocked}].`,
            policy_id: policyId,
            rule_id: 'rule_blocked_paths',
            risk_level: 'critical',
            should_terminate_session: terminate,
            termination_reason: `Security violation: Prohibited path access to ${pathToCheck}`
          };
        }
      }
    }

    // Check allowed paths whitelist if provided
    if (rules.allowed_paths && rules.allowed_paths.length > 0) {
      const isPathAllowed = rules.allowed_paths.some(allowed => matchPattern(pathToCheck, allowed));
      if (!isPathAllowed) {
        const terminate = rules.auto_terminate_on_violation ?? false;
        return {
          decision: 'DENY',
          reason: `Target path '${pathToCheck}' is not permitted under allowed_paths whitelist.`,
          policy_id: policyId,
          rule_id: 'rule_allowed_paths_whitelist',
          risk_level: 'high',
          should_terminate_session: terminate,
          termination_reason: `Unauthorized file access outside allowed boundary: ${pathToCheck}`
        };
      }
    }
  }

  // 8. Network & Domain Restrictions
  const domainToCheck = (args.domain || args.url || args.host || (target.startsWith('http') ? target : '')).toLowerCase();
  if (domainToCheck) {
    if (rules.blocked_domains && rules.blocked_domains.length > 0) {
      for (const blocked of rules.blocked_domains) {
        if (matchPattern(domainToCheck, blocked) || domainToCheck.includes(blocked.replace(/\*/g, ''))) {
          return {
            decision: 'DENY',
            reason: `Network destination '${domainToCheck}' is blocked by policy: blocked_domains [${blocked}].`,
            policy_id: policyId,
            rule_id: 'rule_blocked_domains',
            risk_level: 'critical',
            should_terminate_session: rules.auto_terminate_on_violation ?? true,
            termination_reason: `Outbound connection attempt to blocked domain: ${domainToCheck}`
          };
        }
      }
    }

    if (rules.allowed_domains && rules.allowed_domains.length > 0) {
      const isDomainAllowed = rules.allowed_domains.some(allowed => matchPattern(domainToCheck, allowed));
      if (!isDomainAllowed && domainToCheck.length > 3) {
        return {
          decision: 'DENY',
          reason: `Network destination '${domainToCheck}' is not on the permitted allowed_domains whitelist.`,
          policy_id: policyId,
          rule_id: 'rule_allowed_domains_whitelist',
          risk_level: 'high',
          should_terminate_session: false
        };
      }
    }
  }

  // 9. Sensitive Data in Arguments
  if (rules.sensitive_data_patterns && rules.sensitive_data_patterns.length > 0) {
    for (const pattern of rules.sensitive_data_patterns) {
      try {
        const reg = new RegExp(pattern, 'i');
        if (reg.test(argsString) || reg.test(target)) {
          return {
            decision: 'DENY',
            reason: `Request payload contains sensitive data matching pattern [${pattern}]. Exfiltration blocked.`,
            policy_id: policyId,
            rule_id: 'rule_sensitive_payload_filter',
            risk_level: 'critical',
            should_terminate_session: rules.auto_terminate_on_violation ?? true,
            termination_reason: 'Sensitive token detected in tool arguments'
          };
        }
      } catch {
        // Ignore bad regex in user policy
      }
    }
  }

  // All checks passed -> ALLOW
  return {
    decision: 'ALLOW',
    reason: `Action '${req.action}' on tool '${req.tool}' complies with policy '${policy.name}' (v${policy.version}).`,
    policy_id: policyId,
    rule_id: 'rule_policy_passed',
    risk_level: 'low',
    should_terminate_session: false
  };
}

export function evaluateReview(
  req: ReviewRequest,
  policy: Policy,
  session: AgentSession
): ReviewEvaluationResult {
  if (session.status === 'terminated') {
    return {
      decision: 'TERMINATE',
      reason: 'Session is already terminated.',
      risk_level: 'critical',
      should_terminate_session: false
    };
  }

  const rules: Partial<PolicyRules> = policy?.rules || {};
  const toolResultStr = typeof req.tool_result === 'string' ? req.tool_result : JSON.stringify(req.tool_result || '');
  const hasError = !!req.error;

  // 1. Scan result for sensitive leaked data / API keys / Private keys
  if (rules.sensitive_data_patterns && rules.sensitive_data_patterns.length > 0) {
    for (const pattern of rules.sensitive_data_patterns) {
      try {
        const reg = new RegExp(pattern, 'i');
        if (reg.test(toolResultStr)) {
          return {
            decision: 'TERMINATE',
            reason: `Critical Policy Violation: Tool result contains exposed credentials matching [${pattern}]. Session terminated to prevent exfiltration.`,
            risk_level: 'critical',
            should_terminate_session: true,
            termination_reason: 'Exposed credentials detected in agent tool result'
          };
        }
      } catch {
        // Regex catch
      }
    }
  }

  // Check for common leaked secret signatures
  const leakedSecretSigns = [
    'BEGIN RSA PRIVATE KEY',
    'BEGIN PRIVATE KEY',
    'AIzaSy',
    'sk-proj-',
    'ghp_'
  ];
  for (const sign of leakedSecretSigns) {
    if (toolResultStr.includes(sign)) {
      return {
        decision: 'TERMINATE',
        reason: `Critical security breach: Raw private key or platform secret '${sign}' surfaced in tool output. Session killed.`,
        risk_level: 'critical',
        should_terminate_session: true,
        termination_reason: `Raw credential detected in tool output: ${sign}`
      };
    }
  }

  // 2. Check failure counts and errors
  if (hasError) {
    const currentFailures = (session.failure_count || 0) + 1;
    if (rules.max_failures_per_session && currentFailures >= rules.max_failures_per_session) {
      const autoTerm = rules.auto_terminate_on_max_failures ?? true;
      if (autoTerm) {
        return {
          decision: 'TERMINATE',
          reason: `Failure threshold reached (${currentFailures}/${rules.max_failures_per_session} failures). Session automatically terminated.`,
          risk_level: 'high',
          should_terminate_session: true,
          termination_reason: 'Maximum failure threshold reached'
        };
      }
      return {
        decision: 'WARN',
        reason: `Tool encountered error. Failure limit reached (${currentFailures}/${rules.max_failures_per_session}).`,
        risk_level: 'high',
        should_terminate_session: false
      };
    }

    return {
      decision: 'WARN',
      reason: `Tool execution reported an error: ${req.error}. Failure recorded (${currentFailures}/${rules.max_failures_per_session || 3}).`,
      risk_level: 'medium',
      should_terminate_session: false
    };
  }

  // Clean execution
  return {
    decision: 'CONTINUE',
    reason: 'Tool result verified clean; no sensitive data exposure or policy violations detected.',
    risk_level: 'low',
    should_terminate_session: false
  };
}
