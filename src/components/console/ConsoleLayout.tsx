/**
 * Warden Console Main Layout
 * Responsive Sidebar Navigation & Workspace Context Switcher
 * Creignificent LLC
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  LayoutDashboard,
  FolderGit2,
  Sliders,
  Cpu,
  FileCheck2,
  Terminal,
  KeyRound,
  Code2,
  Users,
  Gauge,
  CreditCard,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Building,
  Menu,
  X,
  Radio,
  ExternalLink
} from 'lucide-react';

interface ConsoleLayoutProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onGoToLanding: () => void;
  children: React.ReactNode;
}

export const ConsoleLayout: React.FC<ConsoleLayoutProps> = ({
  activeTab,
  onSelectTab,
  onGoToLanding,
  children
}) => {
  const { user, organization, organizations, switchOrganization, projects, currentProject, setCurrentProject, logout, role } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isProjDropdownOpen, setIsProjDropdownOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'policies', label: 'Policies', icon: Sliders },
    { id: 'sessions', label: 'Agent Sessions', icon: Cpu },
    { id: 'audit_logs', label: 'Audit Logs', icon: FileCheck2 },
    { id: 'playground', label: 'Playground', icon: Terminal, highlight: true },
    { id: 'api_keys', label: 'API Keys', icon: KeyRound },
    { id: 'developers', label: 'Developers & SDKs', icon: Code2 },
    { id: 'team', label: 'Team (RBAC)', icon: Users },
    { id: 'usage', label: 'Usage & Quotas', icon: Gauge },
    { id: 'billing', label: 'Billing (Stripe)', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'tests', label: 'Automated Tests', icon: ShieldCheck, badge: '11 Tests' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Top Mobile Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">Warden<span className="text-cyan-400">Ai</span></span>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Logo & Brand */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <button
              onClick={onGoToLanding}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-white text-base tracking-tight leading-none">Warden<span className="text-cyan-400">Ai</span></div>
                <div className="text-[10px] text-cyan-400 font-mono font-semibold uppercase mt-0.5">Control Plane</div>
              </div>
            </button>
          </div>

          {/* Org & Project Selector */}
          <div className="space-y-2">
            {/* Organization Selector */}
            <div className="relative">
              <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                Organization
              </label>
              <button
                onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate font-semibold">{organization?.name || 'Creignificent LLC'}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </button>

              {isOrgDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-50 p-1.5 space-y-1">
                  {organizations.map(org => (
                    <button
                      key={org.id}
                      onClick={() => {
                        switchOrganization(org.id);
                        setIsOrgDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold truncate ${
                        organization?.id === org.id
                          ? 'bg-cyan-500 text-slate-950'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {org.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Project Selector */}
            {projects.length > 0 && (
              <div className="relative">
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                  Active Project
                </label>
                <button
                  onClick={() => setIsProjDropdownOpen(!isProjDropdownOpen)}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FolderGit2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate font-semibold">{currentProject?.name}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </button>

                {isProjDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-50 p-1.5 space-y-1">
                    {projects.map(proj => (
                      <button
                        key={proj.id}
                        onClick={() => {
                          setCurrentProject(proj);
                          setIsProjDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold truncate ${
                          currentProject?.id === proj.id
                            ? 'bg-cyan-500 text-slate-950'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {proj.name} ({proj.environment})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 pt-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => {
                    onSelectTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                      : item.highlight
                      ? 'text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isActive ? 'bg-slate-950 text-cyan-400 font-bold' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Footer Profile & Sign Out */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between mb-2">
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{user?.name || 'Security Operator'}</div>
              <div className="text-[11px] text-slate-500 font-mono truncate">{user?.email}</div>
            </div>

            <button
              id="logout-btn"
              onClick={logout}
              className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="text-[10px] text-slate-600 font-mono text-center pt-2 border-t border-slate-800/60">
            Sponsored by Creignificent LLC
          </div>
        </div>
      </aside>

      {/* Main Console Content View */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
