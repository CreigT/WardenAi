/**
 * Warden Console: Team View
 * RBAC Member management (Owner, Admin, Developer, Viewer)
 * Creignificent LLC
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Mail,
  CheckCircle2,
  X
} from 'lucide-react';
import type { OrganizationMember, Role } from '../../types';

export const TeamView: React.FC = () => {
  const { organization, role } = useAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('developer');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (organization) loadMembers();
  }, [organization]);

  const loadMembers = async () => {
    try {
      if (!organization) return;
      const data = await api.getMembers(organization.id);
      setMembers(data);
    } catch (err) {
      console.error('Failed to load team members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !organization) return;
    setSubmitting(true);
    try {
      const added = await api.inviteMember(organization.id, {
        email: inviteEmail,
        name: inviteName,
        role: inviteRole
      });
      setMembers(prev => [...prev, added]);
      setIsModalOpen(false);
      setInviteEmail('');
      setInviteName('');
    } catch (err: any) {
      alert(err.message || 'Failed to invite member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (userId: string, email: string) => {
    if (!organization) return;
    if (!confirm(`Are you sure you want to remove ${email} from ${organization.name}?`)) return;
    try {
      await api.removeMember(organization.id, userId);
      setMembers(prev => prev.filter(m => m.user_id !== userId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  };

  return (
    <div id="warden-team-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-cyan-400" />
            Team & Access Control (RBAC)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage organization members and assign role-based permissions across policy deployment and kill switch controls.
          </p>
        </div>

        {(role === 'owner' || role === 'admin') && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Invite Teammate
          </button>
        )}
      </div>

      {/* Members Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3.5 px-4">Member</th>
              <th className="py-3.5 px-4">Role</th>
              <th className="py-3.5 px-4">Joined Date</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {members.map(m => (
              <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="font-semibold text-white">{m.user?.name || 'Authorized Member'}</div>
                  <div className="text-[11px] font-mono text-slate-400">{m.user?.email}</div>
                </td>

                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase border ${
                      m.role === 'owner'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        : m.role === 'admin'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                        : m.role === 'developer'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Shield className="w-3 h-3" />
                    {m.role}
                  </span>
                </td>

                <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                  {new Date(m.created_at).toLocaleDateString()}
                </td>

                <td className="py-3.5 px-4 text-right">
                  {m.role !== 'owner' && (role === 'owner' || role === 'admin') && (
                    <button
                      onClick={() => handleRemove(m.user_id, m.user?.email || '')}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Remove Member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
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
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Invite Team Member</h3>
                <p className="text-xs text-slate-400">Grant control plane access to {organization?.name}</p>
              </div>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Teammate Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="engineer@company.com"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name (Optional)</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Access Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as Role)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="admin">Admin (Full policy, project & member management)</option>
                  <option value="developer">Developer (Playground, API keys & audit stream)</option>
                  <option value="viewer">Viewer (Read-only telemetry & audit logs)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
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
                  {submitting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
