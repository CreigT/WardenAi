/**
 * Warden Console Main Layout
 * Creignificent LLC
 */
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield, LayoutDashboard, Bot, Sliders, Cpu, FileCheck2, Terminal, KeyRound,
  Code2, Users, Gauge, CreditCard, Settings, ShieldCheck, LogOut, ChevronDown,
  Building, Menu, X, PlugZap, ClipboardCheck, LockKeyhole, FolderGit2
} from 'lucide-react';

interface ConsoleLayoutProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onGoToLanding: () => void;
  children: React.ReactNode;
}

export const ConsoleLayout: React.FC<ConsoleLayoutProps> = ({ activeTab, onSelectTab, onGoToLanding, children }) => {
  const { user, organization, organizations, switchOrganization, projects, currentProject, setCurrentProject, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isProjDropdownOpen, setIsProjDropdownOpen] = useState(false);

  const coreNav = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'policies', label: 'Policies', icon: Sliders },
    { id: 'sessions', label: 'Sessions', icon: Cpu },
    { id: 'reviews', label: 'Reviews', icon: ClipboardCheck },
    { id: 'integrations', label: 'Integrations', icon: PlugZap },
    { id: 'audit_logs', label: 'Audit Logs', icon: FileCheck2 },
    { id: 'credentials', label: 'Credentials', icon: LockKeyhole }
  ];

  const secondaryNav = [
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'playground', label: 'Playground', icon: Terminal },
    { id: 'api_keys', label: 'API Keys', icon: KeyRound },
    { id: 'developers', label: 'Developers & SDKs', icon: Code2 },
    { id: 'team', label: 'Team (RBAC)', icon: Users },
    { id: 'usage', label: 'Usage & Quotas', icon: Gauge },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'tests', label: 'Automated Tests', icon: ShieldCheck },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const renderNav = (items: typeof coreNav) => items.map(item => {
    const Icon = item.icon;
    const active = activeTab === item.id;
    return <button key={item.id} onClick={() => { onSelectTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${active ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}>
      <Icon className="w-4 h-4 shrink-0" /><span>{item.label}</span>
    </button>;
  });

  return <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
    <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
      <button onClick={onGoToLanding} className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400"><Shield className="w-4 h-4" /></div><span className="font-bold">Warden<span className="text-cyan-400">AI</span></span></button>
      <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400 rounded-lg bg-slate-800">{isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
    </div>

    <aside className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      <div className="p-4 overflow-y-auto flex-1 space-y-4">
        <button onClick={onGoToLanding} className="w-full flex items-center gap-2.5 text-left pb-3 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400"><Shield className="w-5 h-5" /></div>
          <div><div className="font-extrabold text-white">Warden<span className="text-cyan-400">AI</span></div><div className="text-[10px] text-cyan-400 font-mono uppercase">Zero-Trust Control Plane</div></div>
        </button>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[10px] leading-relaxed text-slate-400">
          <div className="text-cyan-300 font-bold uppercase tracking-wider mb-1">Enforcement Flow</div>
          Agent → Policy → Review → Execute → Audit
        </div>

        <div className="space-y-2">
          <div className="relative">
            <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Organization</label>
            <button onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)} className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200">
              <div className="flex items-center gap-2 truncate"><Building className="w-3.5 h-3.5 text-cyan-400"/><span className="truncate font-semibold">{organization?.name || 'Creignificent LLC'}</span></div><ChevronDown className="w-3.5 h-3.5 text-slate-500"/>
            </button>
            {isOrgDropdownOpen && <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-50 p-1.5">{organizations.map(org => <button key={org.id} onClick={() => { switchOrganization(org.id); setIsOrgDropdownOpen(false); }} className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800">{org.name}</button>)}</div>}
          </div>

          {projects.length > 0 && <div className="relative">
            <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Active Project</label>
            <button onClick={() => setIsProjDropdownOpen(!isProjDropdownOpen)} className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200">
              <div className="flex items-center gap-2 truncate"><FolderGit2 className="w-3.5 h-3.5 text-cyan-400"/><span className="truncate font-semibold">{currentProject?.name}</span></div><ChevronDown className="w-3.5 h-3.5 text-slate-500"/>
            </button>
            {isProjDropdownOpen && <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-50 p-1.5">{projects.map(proj => <button key={proj.id} onClick={() => { setCurrentProject(proj); setIsProjDropdownOpen(false); }} className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800">{proj.name}</button>)}</div>}
          </div>}
        </div>

        <nav className="space-y-1"><div className="text-[10px] uppercase tracking-wider text-slate-600 font-bold px-3 pb-1">Core enforcement</div>{renderNav(coreNav)}</nav>
        <nav className="space-y-1 pt-2"><div className="text-[10px] uppercase tracking-wider text-slate-600 font-bold px-3 pb-1">Operations</div>{renderNav(secondaryNav)}</nav>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between mb-2"><div className="min-w-0"><div className="text-xs font-bold text-white truncate">{user?.name || 'Security Operator'}</div><div className="text-[11px] text-slate-500 font-mono truncate">{user?.email}</div></div><button onClick={logout} className="p-1.5 text-slate-500 hover:text-red-400"><LogOut className="w-4 h-4"/></button></div>
        <div className="text-[10px] text-slate-600 font-mono text-center pt-2 border-t border-slate-800/60">Sponsored by CREIGNIFICENT LLC.</div>
      </div>
    </aside>

    <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto"><div className="max-w-7xl mx-auto">{children}</div></main>
  </div>;
};