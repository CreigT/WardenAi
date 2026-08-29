/**
 * Warden Auth & Multi-Tenant SaaS Context
 * Creignificent LLC
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import type { User, Organization, OrganizationMember, Project, Role } from '../types';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  member: OrganizationMember | null;
  organizations: Organization[];
  projects: Project[];
  currentProject: Project | null;
  role: Role;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, orgName?: string) => Promise<void>;
  googleLogin: (email?: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  setCurrentProject: (project: Project) => void;
  refreshState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [member, setMember] = useState<OrganizationMember | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshState = useCallback(async () => {
    try {
      const data = await api.getMe();
      if (data.user) {
        setUser(data.user);
        setOrganization(data.organization);
        setMember(data.member);
        setOrganizations(data.organizations || [data.organization]);
        setProjects(data.projects || []);
        if (data.projects && data.projects.length > 0) {
          setCurrentProject(prev => {
            const found = data.projects.find(p => p.id === prev?.id);
            return found || data.projects[0];
          });
        }
      }
    } catch (err) {
      console.error('Failed to load user session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login({ email, password });
      setUser(res.user);
      setOrganization(res.organization);
      setMember(res.member);
      await refreshState();
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string, orgName?: string) => {
    setIsLoading(true);
    try {
      const res = await api.signup({ email, password, name, org_name: orgName });
      setUser(res.user);
      setOrganization(res.organization);
      setMember(res.member);
      if (res.project) {
        setCurrentProject(res.project);
      }
      await refreshState();
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (email?: string, name?: string) => {
    setIsLoading(true);
    try {
      const res = await api.googleLogin({
        email: email || 'CreigTerrence@gmail.com',
        name: name || 'Creig Terrence (Creignificent)'
      });
      setUser(res.user);
      setOrganization(res.organization);
      setMember(res.member);
      await refreshState();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
      setUser(null);
      setOrganization(null);
      setMember(null);
      setProjects([]);
      setCurrentProject(null);
      await refreshState();
    } finally {
      setIsLoading(false);
    }
  };

  const switchOrganization = async (orgId: string) => {
    api.setActiveOrgId(orgId);
    const targetOrg = organizations.find(o => o.id === orgId) || null;
    setOrganization(targetOrg);
    const orgProjects = await api.getProjects(orgId);
    setProjects(orgProjects);
    if (orgProjects.length > 0) {
      setCurrentProject(orgProjects[0]);
    } else {
      setCurrentProject(null);
    }
  };

  const role: Role = member?.role || 'developer';

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        member,
        organizations,
        projects,
        currentProject,
        role,
        isLoading,
        login,
        signup,
        googleLogin,
        logout,
        switchOrganization,
        setCurrentProject,
        refreshState
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
