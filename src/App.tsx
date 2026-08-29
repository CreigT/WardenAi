/**
 * Warden Main Application Component
 * Creignificent LLC
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './components/landing/LandingPage';
import { ConsoleLayout } from './components/console/ConsoleLayout';
import { OverviewView } from './components/console/OverviewView';
import { ProjectsView } from './components/console/ProjectsView';
import { PoliciesView } from './components/console/PoliciesView';
import { SessionsView } from './components/console/SessionsView';
import { AuditLogsView } from './components/console/AuditLogsView';
import { PlaygroundView } from './components/console/PlaygroundView';
import { ApiKeysView } from './components/console/ApiKeysView';
import { DevelopersView } from './components/console/DevelopersView';
import { TeamView } from './components/console/TeamView';
import { UsageView } from './components/console/UsageView';
import { BillingView } from './components/console/BillingView';
import { SettingsView } from './components/console/SettingsView';
import { TestRunnerView } from './components/console/TestRunnerView';
import { AuthModal } from './components/auth/AuthModal';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState<'landing' | 'console'>('landing');
  const [activeConsoleTab, setActiveConsoleTab] = useState<string>('overview');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');

  const handleOpenAuth = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleEnterConsole = () => {
    if (!user) {
      handleOpenAuth('login');
    } else {
      setCurrentView('console');
    }
  };

  return (
    <>
      {currentView === 'landing' ? (
        <LandingPage
          onOpenAuth={handleOpenAuth}
          onEnterConsole={handleEnterConsole}
          isAuthenticated={!!user}
        />
      ) : (
        <ConsoleLayout
          activeTab={activeConsoleTab}
          onSelectTab={setActiveConsoleTab}
          onGoToLanding={() => setCurrentView('landing')}
        >
          {activeConsoleTab === 'overview' && <OverviewView onNavigate={setActiveConsoleTab} />}
          {activeConsoleTab === 'projects' && <ProjectsView />}
          {activeConsoleTab === 'policies' && <PoliciesView />}
          {activeConsoleTab === 'sessions' && <SessionsView />}
          {activeConsoleTab === 'audit_logs' && <AuditLogsView />}
          {activeConsoleTab === 'playground' && <PlaygroundView />}
          {activeConsoleTab === 'api_keys' && <ApiKeysView />}
          {activeConsoleTab === 'developers' && <DevelopersView />}
          {activeConsoleTab === 'team' && <TeamView />}
          {activeConsoleTab === 'usage' && <UsageView />}
          {activeConsoleTab === 'billing' && <BillingView />}
          {activeConsoleTab === 'settings' && <SettingsView />}
          {activeConsoleTab === 'tests' && <TestRunnerView />}
        </ConsoleLayout>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onSuccess={() => {
          setAuthModalOpen(false);
          setCurrentView('console');
        }}
      />
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
