/**
 * Warden Console: Projects View
 * Manage projects across Development, Staging, and Production environments
 * Creignificent LLC
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  FolderGit2,
  Plus,
  Server,
  Shield,
  Layers,
  ArrowRight,
  Trash2,
  Edit2,
  CheckCircle2,
  X
} from 'lucide-react';
import type { Project, Environment } from '../../types';

export const ProjectsView: React.FC = () => {
  const { currentProject, setCurrentProject, organization, refreshState } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectEnv, setNewProjectEnv] = useState<Environment>('development');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [organization]);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects(organization?.id);
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) return;
    setSubmitting(true);
    try {
      const created = await api.createProject({
        name: newProjectName,
        description: newProjectDesc,
        environment: newProjectEnv,
        organization_id: organization?.id
      });
      setProjects(prev => [...prev, created]);
      setCurrentProject(created);
      setIsModalOpen(false);
      setNewProjectName('');
      setNewProjectDesc('');
      await refreshState();
    } catch (err: any) {
      alert(err.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (projects.length <= 1) {
      alert('Cannot delete the only project in an organization.');
      return;
    }
    if (!confirm(`Are you sure you want to delete project '${name}'? This will permanently remove its associated policies and sessions.`)) {
      return;
    }
    try {
      await api.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      if (currentProject?.id === id) {
        const remaining = projects.filter(p => p.id !== id);
        if (remaining.length > 0) setCurrentProject(remaining[0]);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete project');
    }
  };

  return (
    <div id="warden-projects-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FolderGit2 className="w-6 h-6 text-cyan-400" />
            Projects
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Warden project workspaces isolate security policies, API credentials, and agent sessions by environment.
          </p>
        </div>

        <button
          id="create-project-modal-btn"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Project
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map(proj => {
          const isSelected = currentProject?.id === proj.id;
          return (
            <div
              key={proj.id}
              className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all relative ${
                isSelected
                  ? 'border-cyan-500/60 shadow-xl shadow-cyan-500/5 ring-1 ring-cyan-500/30'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border font-mono ${
                      proj.environment === 'production'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        : proj.environment === 'staging'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                    }`}
                  >
                    {proj.environment}
                  </span>

                  {isSelected && (
                    <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/60">
                      <CheckCircle2 className="w-3 h-3" />
                      Active Workspace
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-white mb-1.5">{proj.name}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                  {proj.description || 'No description provided.'}
                </p>

                <div className="text-[11px] font-mono text-slate-500 space-y-1 mb-4">
                  <div>ID: {proj.id}</div>
                  <div>Created: {new Date(proj.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                <button
                  onClick={() => setCurrentProject(proj)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {isSelected ? 'Currently Selected' : 'Switch to Project'}
                </button>

                <button
                  onClick={() => handleDeleteProject(proj.id, proj.name)}
                  className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  title="Delete Project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Create New Project</h3>
                <p className="text-xs text-slate-400">Add an isolated agent security workspace</p>
              </div>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="e.g. Customer Support Agent Cluster"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description</label>
                <textarea
                  rows={2}
                  value={newProjectDesc}
                  onChange={e => setNewProjectDesc(e.target.value)}
                  placeholder="Describe the agent workforce and security scope..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Environment</label>
                <select
                  value={newProjectEnv}
                  onChange={e => setNewProjectEnv(e.target.value as Environment)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
