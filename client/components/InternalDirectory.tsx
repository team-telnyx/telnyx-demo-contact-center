'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  Search,
  Users,
  Loader2,
  PhoneCall,
  UserCircle,
  X,
} from 'lucide-react';
import api from '../lib/api';
import { useSocket } from '../lib/socket';

const PRESENCE_COLORS = {
  online: 'bg-tx-green shadow-[0_0_8px_rgba(52,211,153,0.6)]',
  available: 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]',
  busy: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]',
  away: 'bg-tx-citron shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  offline: 'bg-tx-s3',
};

const PRESENCE_LABELS = {
  online: 'Online',
  available: 'Available',
  busy: 'Busy',
  away: 'Away',
  offline: 'Offline',
};

export default function InternalDirectory({ onCallAgent, compact = false }: { onCallAgent?: (agent: any) => void; compact?: boolean }) {
  const { on } = useSocket();
  const [directory, setDirectory] = useState<any[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});
  const [query, setQuery] = useState<string>('');
  const [calling, setCalling] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    api.get('/internal-chat/directory')
      .then((data) => {
        setDirectory(Array.isArray(data) ? data : []);
        const pm = {};
        for (const a of data) {
          pm[a.id] = a.presence || 'offline';
        }
        setPresenceMap(pm);
      })
      .catch((err) => console.error('Failed to load directory', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const off = on('internal:presence', ({ agentId, presence }) => {
      setPresenceMap((prev) => ({ ...prev, [agentId]: presence }));
      setDirectory((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, presence } : a))
      );
    });
    return () => off();
  }, [on]);

  const filtered = useMemo(
    () => directory.filter((a) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return `${a.displayName || ''} ${a.extension || ''} ${a.role || ''}`.toLowerCase().includes(q);
    }),
    [directory, query]
  );

  async function handleCall(agent: any): Promise<void> {
    if (calling) return;
    setCalling(agent.id);
    try {
      await onCallAgent?.(agent);
    } catch (err: any) {
      console.error('Failed to call agent', err);
    } finally {
      setCalling(null);
    }
  }

  const onlineCount = Object.values(presenceMap).filter((p) => p === 'online' || p === 'available').length;

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-tx-green" />
            <span className="text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em]">Directory</span>
          </div>
          <span className="text-[9px] text-tx-green font-medium">{onlineCount} online</span>
        </div>

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {loading && <div className="text-center py-4"><Loader2 className="w-3.5 h-3.5 animate-spin text-tx-ts mx-auto" /></div>}
          {filtered.map((a) => {
            const presence = presenceMap[a.id] || a.presence || 'offline';
            const isAvailable = presence === 'online' || presence === 'available';
            return (
              <div
                key={a.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-tx-s3 hover:bg-tx-s3 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full ${PRESENCE_COLORS[presence] || PRESENCE_COLORS.offline}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-tx-tp font-medium truncate">{a.displayName}</p>
                </div>
                {a.extension && (
                  <span className="text-[9px] text-tx-ts font-mono">{a.extension}</span>
                )}
                <button
                  onClick={() => handleCall(a)}
                  disabled={!isAvailable || calling === a.id}
                  className="p-1 rounded-lg hover:bg-tx-green/10 text-tx-green disabled:text-tx-ts disabled:cursor-not-allowed transition-colors"
                  title={`Call ${a.displayName}`}
                >
                  {calling === a.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Phone className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="elev-1 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <Users className="w-4 h-4 text-tx-tp" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-tx-tp">Internal Directory</h3>
            <p className="text-[10px] text-tx-ts">{onlineCount} agents available</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tx-ts" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search agents…"
          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-tx-s3 border border-tx-bdefault/50 text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/40"
        />
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-tx-ts" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-tx-ts text-xs py-4">No agents found</p>
        )}
        {filtered.map((a) => {
          const presence = presenceMap[a.id] || a.presence || 'offline';
          const isAvailable = presence === 'online' || presence === 'available';
          return (
            <div
              key={a.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isAvailable ? 'hover:bg-tx-s3' : 'opacity-60'
              }`}
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-tx-green/20 to-tx-citron/20 border border-tx-bdefault/50 flex items-center justify-center">
                  <UserCircle className="w-4 h-4 text-tx-green" />
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-tx-s2 ${
                  PRESENCE_COLORS[presence] || PRESENCE_COLORS.offline
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-tx-tp truncate">{a.displayName}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-tx-ts">{PRESENCE_LABELS[presence] || 'Unknown'}</span>
                  {a.extension && (
                    <span className="text-[9px] text-tx-ts font-mono">· ext {a.extension}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleCall(a)}
                disabled={!isAvailable || calling === a.id}
                className="p-2 rounded-lg bg-tx-green/10 border border-tx-green/20 text-tx-green hover:bg-tx-green/20 disabled:bg-tx-s3 disabled:text-tx-ts disabled:border-transparent disabled:cursor-not-allowed transition-all"
                title={isAvailable ? `Call ${a.displayName}` : 'Agent unavailable'}
              >
                {calling === a.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PhoneCall className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
