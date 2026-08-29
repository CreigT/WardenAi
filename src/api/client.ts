/**
 * Warden Typed API Client
 * Connects frontend React client to Express full-stack security backend
 * Creignificent LLC
 */

import type {
  User,
  Organization,
  OrganizationMember,
  Project,
  Policy,
  AgentSession,
  AgentAction,
  AuditLog,
  ApiKey,
  Subscription,
  UsageRecord,
  AdmitRequest,
  AdmitResponse,
  ReviewRequest,
  ReviewResponse,
  TerminateSessionResponse,
  TestResultItem,
  SubscriptionPlan
} from '../types';

const API_BASE = '/api/v1';

class ApiClient {
  private token: string | null = null;
  private activeOrgId: string | null = null;

  constructor() {
    // Read cached token from session if available
    try {
      this.token = sessionStorage.getItem('warden_token');
      this.activeOrgId = sessionStorage.getItem('warden_org_id');
    } catch {
      // browser storage fallback
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      sessionStorage.setItem('warden_token', token);
    } else {
      sessionStorage.removeItem('warden_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public setActiveOrgId(orgId: string | null) {
    this.activeOrgId = orgId;
    if (orgId) {
      sessionStorage.setItem('warden_org_id', orgId);
    } else {
      sessionStorage.removeItem('warden_org_id');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.activeOrgId) {
      headers['x-organization-id'] = this.activeOrgId;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        errorMsg = errorJson.error || errorJson.message || errorMsg;
      } catch {
        // use fallback statusText
      }
      throw new Error(errorMsg);
    }

    return response.json() as Promise<T>;
  }

  // Auth
  public async signup(data: { email: string; password: string; name: string; org_name?: string }) {
    const res = await this.request<{ token: string; user: User; organization: Organization; member: OrganizationMember; project: Project }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.setToken(res.token);
    this.setActiveOrgId(res.organization.id);
    return res;
  }

  public async login(data: { email: string; password: string }) {
    const res = await this.request<{ token: string; user: User; organization: Organization; member: OrganizationMember }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.setToken(res.token);
    this.setActiveOrgId(res.organization.id);
    return res;
  }

  public async googleLogin(data: { email?: string; name?: string; avatar_url?: string }) {
    const res = await this.request<{ token: string; user: User; organization: Organization; member: OrganizationMember }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.setToken(res.token);
    this.setActiveOrgId(res.organization.id);
    return res;
  }

  public async getMe() {
    return this.request<{
      user: User;
      organization: Organization;
      member: OrganizationMember;
      organizations: Organization[];
      projects: Project[];
    }>('/auth/me');
  }

  public async resetPassword(email: string) {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  public async logout() {
    this.setToken(null);
    return this.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
  }

  // Organizations & Members
  public async getOrganizations() {
    return this.request<Organization[]>('/organizations');
  }

  public async createOrganization(name: string) {
    return this.request<Organization>('/organizations', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  public async getMembers(orgId: string) {
    return this.request<OrganizationMember[]>(`/organizations/${orgId}/members`);
  }

  public async inviteMember(orgId: string, data: { email: string; name?: string; role: string }) {
    return this.request<OrganizationMember>(`/organizations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async removeMember(orgId: string, userId: string) {
    return this.request<{ success: boolean }>(`/organizations/${orgId}/members/${userId}`, {
      method: 'DELETE'
    });
  }

  // Projects
  public async getProjects(orgId?: string) {
    const q = orgId ? `?organization_id=${orgId}` : '';
    return this.request<Project[]>(`/projects${q}`);
  }

  public async createProject(data: { name: string; description?: string; environment?: string; organization_id?: string }) {
    return this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async updateProject(id: string, data: Partial<Project>) {
    return this.request<Project>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  public async deleteProject(id: string) {
    return this.request<{ success: boolean }>(`/projects/${id}`, {
      method: 'DELETE'
    });
  }

  // Policies
  public async getPolicies(projectId?: string) {
    const q = projectId ? `?project_id=${projectId}` : '';
    return this.request<Policy[]>(`/policies${q}`);
  }

  public async getPolicy(id: string) {
    return this.request<Policy>(`/policies/${id}`);
  }

  public async createPolicy(data: Partial<Policy>) {
    return this.request<Policy>('/policies', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async updatePolicy(id: string, data: Partial<Policy>) {
    return this.request<Policy>(`/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Sessions
  public async createSession(data: { project_id?: string; organization_id?: string; agent_id?: string; name?: string; metadata?: any }) {
    return this.request<AgentSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async getSessions(projectId?: string) {
    const q = projectId ? `?project_id=${projectId}` : '';
    return this.request<AgentSession[]>(`/sessions${q}`);
  }

  public async getSessionDetails(sessionId: string) {
    return this.request<{ session: AgentSession; actions: AgentAction[]; audit_logs: AuditLog[] }>(`/sessions/${sessionId}`);
  }

  public async terminateSession(sessionId: string, reason?: string) {
    return this.request<TerminateSessionResponse>(`/sessions/${sessionId}/terminate`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // Enforcement Engine
  public async admit(req: AdmitRequest) {
    return this.request<AdmitResponse>('/admit', {
      method: 'POST',
      body: JSON.stringify(req)
    });
  }

  public async review(req: ReviewRequest) {
    return this.request<ReviewResponse>('/review', {
      method: 'POST',
      body: JSON.stringify(req)
    });
  }

  // Audit Logs & Analytics
  public async getAuditLogs(params?: { event_type?: string; decision?: string; project_id?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.event_type) query.set('event_type', params.event_type);
    if (params?.decision) query.set('decision', params.decision);
    if (params?.project_id) query.set('project_id', params.project_id);
    if (params?.limit) query.set('limit', String(params.limit));

    const qStr = query.toString() ? `?${query.toString()}` : '';
    return this.request<AuditLog[]>(`/audit-logs${qStr}`);
  }

  public async getUsage() {
    return this.request<{
      organization_id: string;
      plan: string;
      limits: any;
      metrics: {
        total_admits: number;
        allowed_admits: number;
        denied_admits: number;
        review_calls: number;
        active_sessions: number;
        terminated_sessions: number;
        threat_prevention_rate: string;
      };
    }>('/usage');
  }

  // API Keys
  public async getApiKeys() {
    return this.request<ApiKey[]>('/api-keys');
  }

  public async createApiKey(data: { project_id: string; name: string; organization_id?: string }) {
    return this.request<{ apiKey: ApiKey; rawKey: string }>('/api-keys', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async revokeApiKey(id: string) {
    return this.request<{ success: boolean; message: string }>(`/api-keys/${id}`, {
      method: 'DELETE'
    });
  }

  // Billing
  public async getSubscription() {
    return this.request<Subscription>('/billing/subscription');
  }

  public async createCheckout(plan: SubscriptionPlan, returnUrl?: string) {
    return this.request<{ url: string; simulated?: boolean }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, returnUrl })
    });
  }

  public async openCustomerPortal(returnUrl?: string) {
    return this.request<{ url: string }>('/billing/portal', {
      method: 'POST',
      body: JSON.stringify({ returnUrl })
    });
  }

  // Tests
  public async runTestSuite() {
    return this.request<{ results: TestResultItem[]; summary: { total: number; passed: number; failed: number; duration_ms: number } }>('/tests/run', {
      method: 'POST'
    });
  }
}

export const api = new ApiClient();
