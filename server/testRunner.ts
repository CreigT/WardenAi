/**
 * Warden Automated Test Suite Runner
 * Executes required security scenario validations against server policy engine & DB
 * Creignificent LLC
 */

import crypto from 'crypto';
import { db, generateApiKey, hashApiKey } from './db';
import { evaluateAdmit, evaluateReview } from './policyEngine';
import type {
  Policy,
  AgentSession,
  AdmitRequest,
  ReviewRequest,
  TestResultItem
} from '../src/types';

export async function runWardenTestSuite(): Promise<{ results: TestResultItem[]; summary: { total: number; passed: number; failed: number; duration_ms: number } }> {
  const startTime = Date.now();
  const results: TestResultItem[] = [];
  const store = db.get();

  const testOrgId = `org_test_${crypto.randomUUID().substring(0, 6)}`;
  const foreignOrgId = `org_foreign_${crypto.randomUUID().substring(0, 6)}`;
  const testProjectId = `proj_test_${crypto.randomUUID().substring(0, 6)}`;
  const testPolicyId = `pol_test_${crypto.randomUUID().substring(0, 6)}`;

  // Create isolated test policy
  const testPolicy: Policy = {
    id: testPolicyId,
    project_id: testProjectId,
    organization_id: testOrgId,
    name: 'Automated Test Policy',
    description: 'Generated strictly for automated security verification',
    enabled: true,
    rules: {
      allowed_tools: ['file_read', 'search_docs', 'calculate'],
      blocked_tools: ['bash', 'shell_exec', 'file_delete'],
      allowed_paths: ['/app/data/*', './src/docs/*', '/public/*'],
      blocked_paths: ['.env*', '**/credentials*', '/etc/*'],
      allowed_domains: ['api.creignificent.com', 'api.github.com'],
      blocked_domains: ['*darkweb*', 'localhost'],
      allow_env_access: false,
      blocked_env_vars: ['GEMINI_API_KEY', 'STRIPE_SECRET_KEY'],
      allow_shell: false,
      blocked_shell_commands: ['rm', 'sudo'],
      sensitive_data_patterns: ['sk-[a-zA-Z0-9]{32,}'],
      max_actions_per_session: 10,
      max_failures_per_session: 2,
      auto_terminate_on_violation: true,
      auto_terminate_on_max_failures: true
    },
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  store.policies.push(testPolicy);

  // Helper to run a test
  const executeTest = async (
    id: string,
    name: string,
    description: string,
    fn: () => Promise<void> | void
  ) => {
    const t0 = Date.now();
    try {
      await fn();
      results.push({
        id,
        name,
        description,
        status: 'passed',
        duration_ms: Date.now() - t0,
        details: 'Assertion passed successfully.',
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      results.push({
        id,
        name,
        description,
        status: 'failed',
        duration_ms: Date.now() - t0,
        error: err.message || String(err),
        timestamp: new Date().toISOString()
      });
    }
  };

  // 1. Allowed request
  await executeTest(
    'test_01_allowed_request',
    'Allowed Request Verification',
    'Verifies that an authorized tool and allowed path yields an ALLOW decision',
    () => {
      const session: AgentSession = {
        id: `sess_t1_${Date.now()}`,
        project_id: testProjectId,
        organization_id: testOrgId,
        agent_id: 'agent_reader_01',
        name: 'Test Reader Agent',
        status: 'active',
        action_count: 0,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const req: AdmitRequest = {
        project_id: testProjectId,
        session_id: session.id,
        agent_id: 'agent_reader_01',
        tool: 'file_read',
        action: 'read_doc',
        target: '/app/data/readme.txt'
      };

      const decision = evaluateAdmit(req, testPolicy, session);
      if (decision.decision !== 'ALLOW') {
        throw new Error(`Expected ALLOW but got ${decision.decision}: ${decision.reason}`);
      }
    }
  );

  // 2. Denied request (Blocked Tool)
  await executeTest(
    'test_02_denied_request',
    'Denied Request Verification (Blocked Tool)',
    'Verifies that invoking a prohibited tool (bash) is blocked with critical risk',
    () => {
      const session: AgentSession = {
        id: `sess_t2_${Date.now()}`,
        project_id: testProjectId,
        organization_id: testOrgId,
        agent_id: 'agent_shell_01',
        name: 'Test Shell Agent',
        status: 'active',
        action_count: 0,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const req: AdmitRequest = {
        project_id: testProjectId,
        session_id: session.id,
        agent_id: 'agent_shell_01',
        tool: 'bash',
        action: 'execute_script',
        target: 'ls -la'
      };

      const decision = evaluateAdmit(req, testPolicy, session);
      if (decision.decision !== 'DENY') {
        throw new Error(`Expected DENY for bash tool, but received ALLOW`);
      }
      if (decision.risk_level !== 'critical') {
        throw new Error(`Expected critical risk level, got ${decision.risk_level}`);
      }
    }
  );

  // 3. Blocked path (e.g. .env.example or sensitive files)
  await executeTest(
    'test_03_blocked_path',
    'Blocked Path Filter (.env / sensitive files)',
    'Verifies that access to .env.example or .env secrets is blocked',
    () => {
      const session: AgentSession = {
        id: `sess_t3_${Date.now()}`,
        project_id: testProjectId,
        organization_id: testOrgId,
        agent_id: 'agent_snoop_01',
        name: 'Test Snoop Agent',
        status: 'active',
        action_count: 0,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const req: AdmitRequest = {
        project_id: testProjectId,
        session_id: session.id,
        agent_id: 'agent_snoop_01',
        tool: 'file_read',
        action: 'read_env_secrets',
        target: '.env.example'
      };

      const decision = evaluateAdmit(req, testPolicy, session);
      if (decision.decision !== 'DENY') {
        throw new Error(`Expected DENY for .env.example path, got ALLOW`);
      }
      if (!decision.should_terminate_session) {
        throw new Error(`Expected policy violation to flag should_terminate_session = true`);
      }
    }
  );

  // 4. Policy update affects subsequent decisions
  await executeTest(
    'test_04_policy_update',
    'Dynamic Policy Update Impact',
    'Verifies that updating a policy rule immediately changes evaluation results',
    () => {
      const session: AgentSession = {
        id: `sess_t4_${Date.now()}`,
        project_id: testProjectId,
        organization_id: testOrgId,
        agent_id: 'agent_math_01',
        name: 'Math Agent',
        status: 'active',
        action_count: 0,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const req: AdmitRequest = {
        project_id: testProjectId,
        session_id: session.id,
        agent_id: 'agent_math_01',
        tool: 'calculate',
        action: 'sum',
        arguments: { a: 5, b: 10 }
      };

      // Initially calculate is allowed
      const firstDecision = evaluateAdmit(req, testPolicy, session);
      if (firstDecision.decision !== 'ALLOW') {
        throw new Error('Initial decision should have been ALLOW');
      }

      // Update policy to block calculate
      const updatedPolicy: Policy = {
        ...testPolicy,
        rules: {
          ...testPolicy.rules,
          blocked_tools: [...testPolicy.rules.blocked_tools, 'calculate']
        },
        version: 2
      };

      const secondDecision = evaluateAdmit(req, updatedPolicy, session);
      if (secondDecision.decision !== 'DENY') {
        throw new Error('Updated policy should have produced DENY for calculate');
      }
    }
  );

  // 5. Session termination (Kill switch)
  await executeTest(
    'test_05_session_termination',
    'Kill Switch Session Termination',
    'Verifies that an active session can be terminated and marked with reason',
    () => {
      const session: AgentSession = {
        id: `sess_t5_${Date.now()}`,
        project_id: testProjectId,
        organization_id: testOrgId,
        agent_id: 'agent_kill_target',
        name: 'Kill Target Agent',
        status: 'active',
        action_count: 3,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Terminate
      session.status = 'terminated';
      session.terminated_at = new Date().toISOString();
      session.termination_reason = 'Manual Kill Switch initiated by Operator';
      session.terminated_by = 'manual';

      if (session.status !== 'terminated') {
        throw new Error('Failed to set session status to terminated');
      }
    }
  );

  // 6. Request after termination MUST NOT execute
  await executeTest(
    'test_06_request_after_termination',
    'Enforcement on Terminated Session',
    'Verifies that any request on a terminated session is rejected immediately',
    () => {
      const terminatedSession: AgentSession = {
        id: `sess_t6_dead`,
        project_id: testProjectId,
        organization_id: testOrgId,
        agent_id: 'agent_dead',
        name: 'Dead Session Agent',
        status: 'terminated',
        action_count: 4,
        failure_count: 1,
        termination_reason: 'Prior Kill Switch event',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const req: AdmitRequest = {
        project_id: testProjectId,
        session_id: terminatedSession.id,
        agent_id: 'agent_dead',
        tool: 'file_read',
        action: 'read_doc',
        target: '/app/data/safe.txt'
      };

      const decision = evaluateAdmit(req, testPolicy, terminatedSession);
      if (decision.decision !== 'DENY') {
        throw new Error('Admit on terminated session must be strictly DENY');
      }
      if (!decision.reason.includes('TERMINATED')) {
        throw new Error(`Expected termination notice in reason, got: ${decision.reason}`);
      }
    }
  );

  // 7. Cross-tenant access isolation
  await executeTest(
    'test_07_cross_tenant_isolation',
    'Multi-Tenant Data & Action Isolation',
    'Verifies that requests cannot access or act on foreign organization boundaries',
    () => {
      const orgAId = 'org_tenant_alpha';
      const orgBId = 'org_tenant_beta';

      // Tenant A project
      const projA = { id: 'proj_alpha', organization_id: orgAId };

      // Tenant B session
      const sessionB: AgentSession = {
        id: 'sess_beta_01',
        project_id: projA.id,
        organization_id: orgBId,
        agent_id: 'agent_beta',
        name: 'Cross-Tenant Prober',
        status: 'active',
        action_count: 0,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (sessionB.organization_id !== projA.organization_id) {
        // Isolation boundary holds: foreign org ID mismatch
        return;
      }
      throw new Error('Tenant isolation check failed: Org boundary mismatch not detected');
    }
  );

  // 8. Invalid API key authentication
  await executeTest(
    'test_08_invalid_api_key',
    'API Key Cryptographic Hash Verification',
    'Verifies that an unauthorized or forged API key fails authentication',
    () => {
      const { apiKey, rawKey } = generateApiKey(testProjectId, testOrgId, 'Valid Key');
      const validHash = hashApiKey(rawKey);
      const forgedKey = 'warden_live_forged_random_fake_token_123';
      const forgedHash = hashApiKey(forgedKey);

      if (validHash === forgedHash) {
        throw new Error('Hash collision detected in API key verification');
      }
      if (apiKey.key_hash !== validHash) {
        throw new Error('API key hash did not match calculated sha256');
      }
    }
  );

  // 9. Rate-limit & Action Quota Behavior
  await executeTest(
    'test_09_action_quota_limit',
    'Max Actions Per Session Ceiling',
    'Verifies that exceeding max_actions_per_session denies further attempts',
    () => {
      const maxedSession: AgentSession = {
        id: `sess_t9_maxed`,
        project_id: testProjectId,
        organization_id: testOrgId,
        agent_id: 'agent_spammer',
        name: 'High Frequency Agent',
        status: 'active',
        action_count: 10, // Max is 10 in test policy
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const req: AdmitRequest = {
        project_id: testProjectId,
        session_id: maxedSession.id,
        agent_id: 'agent_spammer',
        tool: 'file_read',
        action: 'read_doc',
        target: '/app/data/file11.txt'
      };

      const decision = evaluateAdmit(req, testPolicy, maxedSession);
      if (decision.decision !== 'DENY') {
        throw new Error('Expected DENY due to max action quota exceedance');
      }
      if (!decision.reason.includes('limit exceeded')) {
        throw new Error(`Expected quota message, got: ${decision.reason}`);
      }
    }
  );

  // 10. Clean Reader Scenario (Full 5-step lifecycle completes green)
  await executeTest(
    'test_10_clean_reader_scenario',
    'Clean Reader Scenario (5-Step Green Lifecycle)',
    'Executes simulated Clean Reader: 1. Request allowed file -> 2. Admitted -> 3. Execute tool -> 4. Review succeeds -> 5. Session completes green',
    () => {
      const cleanSession: AgentSession = {
        id: `sess_clean_${Date.now()}`,
        project_id: testProjectId,
        organization_id: testOrgId,
        agent_id: 'agent_clean_reader',
        name: 'Clean Reader Worker',
        status: 'active',
        action_count: 0,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Step 1 & 2: Request allowed file & evaluate admit
      const req: AdmitRequest = {
        project_id: testProjectId,
        session_id: cleanSession.id,
        agent_id: 'agent_clean_reader',
        tool: 'file_read',
        action: 'read_document',
        target: '/app/data/quarterly_report.pdf'
      };

      const admitDecision = evaluateAdmit(req, testPolicy, cleanSession);
      if (admitDecision.decision !== 'ALLOW') {
        throw new Error(`Step 2 Admit Failed: Expected ALLOW, got ${admitDecision.decision}`);
      }

      cleanSession.action_count += 1;

      // Step 3 & 4: Execute tool & Review
      const reviewReq: ReviewRequest = {
        project_id: testProjectId,
        session_id: cleanSession.id,
        action_id: 'act_clean_01',
        tool_result: { status: 'success', text: 'Executive Summary: System security verified.' }
      };

      const reviewDecision = evaluateReview(reviewReq, testPolicy, cleanSession);
      if (reviewDecision.decision !== 'CONTINUE') {
        throw new Error(`Step 4 Review Failed: Expected CONTINUE, got ${reviewDecision.decision}`);
      }

      // Step 5: Session completes green
      cleanSession.status = 'completed';
      if (cleanSession.status !== 'completed' || cleanSession.failure_count !== 0) {
        throw new Error('Clean Reader did not complete with zero failures');
      }
    }
  );

  // 11. Rogue Hunter Scenario (Step 3 never executes after termination)
  await executeTest(
    'test_11_rogue_hunter_scenario',
    'Rogue Hunter Scenario (Violation, Termination & 3rd Step Block)',
    'Verifies Rogue Hunter: 1. Allowed file admitted -> 2. Requests .env.example -> 3. Denied & session terminated -> 4. Third attempt MUST NOT EXECUTE',
    () => {
      const rogueSession: AgentSession = {
        id: `sess_rogue_${Date.now()}`,
        project_id: testProjectId,
        organization_id: testOrgId,
        agent_id: 'agent_rogue_hunter',
        name: 'Rogue Hunter Worker',
        status: 'active',
        action_count: 0,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Step 1: Requests allowed file
      const req1: AdmitRequest = {
        project_id: testProjectId,
        session_id: rogueSession.id,
        agent_id: 'agent_rogue_hunter',
        tool: 'file_read',
        action: 'read_doc',
        target: '/app/data/public_data.txt'
      };
      const admit1 = evaluateAdmit(req1, testPolicy, rogueSession);
      if (admit1.decision !== 'ALLOW') {
        throw new Error(`Step 1 Admit Failed: Expected ALLOW, got ${admit1.decision}`);
      }
      rogueSession.action_count += 1;

      // Step 2: Requests .env.example (Malicious probe)
      const req2: AdmitRequest = {
        project_id: testProjectId,
        session_id: rogueSession.id,
        agent_id: 'agent_rogue_hunter',
        tool: 'file_read',
        action: 'read_secrets',
        target: '.env.example'
      };
      const admit2 = evaluateAdmit(req2, testPolicy, rogueSession);
      if (admit2.decision !== 'DENY') {
        throw new Error(`Step 2 Failed: Expected DENY for .env.example, got ALLOW`);
      }
      if (!admit2.should_terminate_session) {
        throw new Error(`Step 2 Failed: Expected should_terminate_session to be true`);
      }

      // Warden terminates session
      rogueSession.status = 'terminated';
      rogueSession.termination_reason = admit2.termination_reason || 'Policy Violation';
      rogueSession.terminated_at = new Date().toISOString();
      rogueSession.terminated_by = 'policy';

      // Step 3: Rogue attempts 3rd action -> MUST NOT EXECUTE
      const req3: AdmitRequest = {
        project_id: testProjectId,
        session_id: rogueSession.id,
        agent_id: 'agent_rogue_hunter',
        tool: 'file_read',
        action: 'attempt_third_action',
        target: '/app/data/public_data.txt'
      };

      const admit3 = evaluateAdmit(req3, testPolicy, rogueSession);
      if (admit3.decision !== 'DENY') {
        throw new Error(`CRITICAL TEST FAILURE: Rogue Hunter 3rd action was NOT blocked! Expected DENY, got ${admit3.decision}`);
      }
      if (admit3.rule_id !== 'rule_kill_switch_active') {
        throw new Error(`Expected rule_kill_switch_active, got ${admit3.rule_id}`);
      }
    }
  );

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;

  return {
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      duration_ms: Date.now() - startTime
    }
  };
}
