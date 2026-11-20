import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  Crown,
  Check,
  Search,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useProject } from '../../projects/ProjectContext';
import { ROLE_LABELS, canInviteRole } from '../../../services/rbac/permissions';
import type { ProjectRole } from '../../../types/database.types';

interface ExpandedPeopleViewProps {
  onOpenTeamModal?: () => void;
}

function getInitials(name?: string, fallback = 'CR'): string {
  if (!name || name.trim().toLowerCase() === 'unassigned') return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ExpandedPeopleView({ onOpenTeamModal }: ExpandedPeopleViewProps) {
  const { members = [], onlineMembers = [], activeRole, activeProject } = useProject();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');

  const onlineUserIds = useMemo(() => {
    return new Set(onlineMembers.map((om) => om.userId));
  }, [onlineMembers]);

  const canInvite = canInviteRole(activeRole as ProjectRole, 'crew');

  const departments = useMemo(() => {
    const depts = new Set<string>();
    members.forEach((m) => {
      if (m.department) depts.add(m.department);
    });
    return Array.from(depts);
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        !searchQuery ||
        (m.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.role || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept =
        selectedDept === 'all' ||
        (m.department || '').toLowerCase() === selectedDept.toLowerCase();
      return matchSearch && matchDept;
    });
  }, [members, searchQuery, selectedDept]);

  return (
    <div
      data-testid="expanded-people-workspace"
      className="flex-1 flex flex-col min-h-0 bg-[#0A0D16]/90 rounded-3xl border border-white/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.6)] overflow-hidden"
    >
      {/* Workspace Header */}
      <div className="px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-300">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">People & Access</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
                {onlineMembers.length > 0 ? `${onlineMembers.length} Online` : `${members.length} Enrolled`}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Authenticated collaborators, department leads, and production roster
            </p>
          </div>
        </div>

        {canInvite && (
          <button
            type="button"
            onClick={onOpenTeamModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs shadow-md transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Manage Access & Invites</span>
          </button>
        )}
      </div>

      {/* Filter Bar: Search + Department Pills */}
      <div className="px-6 py-3 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-white/[0.01]">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, role or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
          <button
            type="button"
            onClick={() => setSelectedDept('all')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
              selectedDept === 'all'
                ? 'bg-white/15 text-white font-medium border border-white/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Departments ({members.length})
          </button>
          {departments.map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setSelectedDept(dept)}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                selectedDept === dept
                  ? 'bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Members Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredMembers.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-white">No members found</p>
            <p className="text-xs text-slate-400 font-mono">
              {searchQuery ? `No members matched "${searchQuery}".` : 'No members enrolled in this project.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredMembers.map((member) => {
              const isOnline = onlineUserIds.has(member.userId);
              const initials = getInitials(member.fullName || member.email);
              const roleMeta = ROLE_LABELS[member.role as ProjectRole];
              const roleLabel = roleMeta?.label || member.role;

              return (
                <div
                  key={member.userId}
                  className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.14] transition-all flex items-start gap-3.5 group relative overflow-hidden"
                >
                  {/* Avatar with Online Ping */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-200 shadow-inner">
                      {initials}
                    </div>
                    {isOnline && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0A0D16] shadow-[0_0_8px_rgba(16,185,129,0.9)]"
                        title="Online now"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-sm text-white truncate group-hover:text-emerald-100 transition-colors">
                        {member.fullName || member.email}
                      </span>
                      {member.role === 'owner' && (
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Project Owner" />
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-mono text-emerald-300 font-medium">
                        {roleLabel}
                      </span>
                      {member.department && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="text-[10px] font-mono text-slate-400 truncate">
                            {member.department}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 mt-2 truncate">
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
