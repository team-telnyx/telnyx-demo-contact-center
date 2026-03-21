'use client';

import { useState, useEffect } from 'react';
import { useAppSelector } from '../../../src/store/hooks';
import { useGetAgentsQuery } from '../../../src/store/api';

// Groups we care about, mapped to display names
const TRACKED_GROUPS = {
  'Programmable Messaging - Outbound': { label: 'SMS — Outbound', category: 'messaging' },
  'Programmable Messaging - Inbound': { label: 'SMS — Inbound', category: 'messaging' },
  'Programmable Messaging - Long Codes': { label: 'SMS — Long Codes', category: 'messaging' },
  'Programmable Messaging - Short Codes': { label: 'SMS — Short Codes', category: 'messaging' },
  'Programmable Messaging - Toll Free Numbers': { label: 'SMS — Toll Free', category: 'messaging' },
  'Programmable Voice - Voice API': { label: 'Voice API', category: 'voice' },
  'Programmable Voice - Voice SDK': { label: 'Voice SDK', category: 'voice' },
  'SIP Trunking - Signaling Regions': { label: 'SIP Trunking — Signaling', category: 'sip' },
  'SIP Trunking - Media Anchorsites': { label: 'SIP Trunking — Media', category: 'sip' },
};

const STATUS_CONFIG = {
  operational: { color: 'bg-green-500', label: 'Operational', textColor: 'text-green-700', bgLight: 'bg-green-50' },
  degraded_performance: { color: 'bg-yellow-400', label: 'Degraded', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50' },
  partial_outage: { color: 'bg-orange-500', label: 'Partial Outage', textColor: 'text-orange-700', bgLight: 'bg-orange-50' },
  major_outage: { color: 'bg-red-500', label: 'Major Outage', textColor: 'text-red-700', bgLight: 'bg-red-50' },
  under_maintenance: { color: 'bg-blue-400', label: 'Maintenance', textColor: 'text-blue-700', bgLight: 'bg-blue-50' },
};

function getWorstStatus(statuses) {
  const rank = ['operational', 'under_maintenance', 'degraded_performance', 'partial_outage', 'major_outage'];
  let worst = 'operational';
  for (const s of statuses) {
    if (rank.indexOf(s) > rank.indexOf(worst)) worst = s;
  }
  return worst;
}

function StatusDot({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.operational;
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cfg.color}`} title={cfg.label} />;
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.operational;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bgLight} ${cfg.textColor}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.color}`} />
      {cfg.label}
    </span>
  );
}

export default function DashboardPage() {
  const { firstName, lastName, username } = useAppSelector((state) => state.auth);
  const { data: agents, isLoading } = useGetAgentsQuery();

  const [statusData, setStatusData] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const onlineAgents = agents?.filter((agent) => agent.status === 'online') || [];
  const totalAgents = agents?.length || 0;

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('https://status.telnyx.com/api/v2/summary.json');
        const data = await res.json();
        setStatusData(data);
        setLastUpdated(new Date());
      } catch (err) {
        setStatusError('Failed to load status');
      } finally {
        setStatusLoading(false);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  // Process status data into grouped services
  const serviceGroups = (() => {
    if (!statusData) return {};
    const groups = {};
    const groupIdToName = {};

    // Build group id → name map
    for (const c of statusData.components) {
      if (c.group) groupIdToName[c.id] = c.name;
    }

    // Collect components into our tracked groups
    for (const c of statusData.components) {
      if (c.group || !c.group_id) continue;
      const groupName = groupIdToName[c.group_id];
      const tracked = TRACKED_GROUPS[groupName];
      if (!tracked) continue;

      if (!groups[tracked.category]) groups[tracked.category] = {};
      if (!groups[tracked.category][groupName]) {
        groups[tracked.category][groupName] = { label: tracked.label, components: [] };
      }
      groups[tracked.category][groupName].components.push({
        name: c.name,
        status: c.status,
        description: c.description,
      });
    }
    return groups;
  })();

  const overallStatus = statusData?.status?.indicator === 'none' ? 'operational' :
    statusData?.status?.indicator === 'minor' ? 'degraded_performance' :
    statusData?.status?.indicator === 'major' ? 'major_outage' : 'operational';

  const CATEGORY_LABELS = {
    voice: { label: 'Programmable Voice', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
    messaging: { label: 'Programmable SMS', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    sip: { label: 'SIP Trunking', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {firstName || username}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Agent dashboard and Telnyx service status.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-card border border-gray-200 bg-white p-5 shadow-sm hover-lift">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-telnyx-green/10">
              <svg className="h-5 w-5 text-telnyx-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Agents</p>
              <p className="text-2xl font-bold text-gray-900">{isLoading ? '...' : totalAgents}</p>
            </div>
          </div>
        </div>

        <div className="rounded-card border border-gray-200 bg-white p-5 shadow-sm hover-lift">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <span className="h-3 w-3 rounded-full bg-telnyx-green"></span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Online Agents</p>
              <p className="text-2xl font-bold text-gray-900">{isLoading ? '...' : onlineAgents.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-card border border-gray-200 bg-white p-5 shadow-sm hover-lift">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Logged in as</p>
              <p className="text-lg font-bold text-gray-900">{firstName} {lastName}</p>
            </div>
          </div>
        </div>

        <div className="rounded-card border border-gray-200 bg-white p-5 shadow-sm hover-lift">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${STATUS_CONFIG[overallStatus]?.bgLight || 'bg-green-50'}`}>
              <StatusDot status={overallStatus} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Telnyx Platform</p>
              <StatusBadge status={overallStatus} />
            </div>
          </div>
        </div>
      </div>

      {/* Telnyx Service Status */}
      <div className="rounded-card border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between rounded-t-card bg-gray-950 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">Telnyx Service Status</h2>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-[10px] text-gray-400">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <a href="https://status.telnyx.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-telnyx-green hover:underline">
              status.telnyx.com
            </a>
          </div>
        </div>

        {statusLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-telnyx-green border-t-transparent"></div>
          </div>
        ) : statusError ? (
          <div className="px-5 py-8 text-center text-sm text-red-400">{statusError}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {Object.entries(CATEGORY_LABELS).map(([catKey, catInfo]) => {
              const groupEntries = Object.entries(serviceGroups[catKey] || {});
              if (groupEntries.length === 0) return null;

              return (
                <div key={catKey} className="px-5 py-4">
                  <div className="mb-3 flex items-center gap-2">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={catInfo.icon} />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-900">{catInfo.label}</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {groupEntries.map(([groupName, group]) => {
                      const worstStatus = getWorstStatus(group.components.map((c) => c.status));
                      return (
                        <div
                          key={groupName}
                          className="flex items-center justify-between rounded-btn border border-gray-100 bg-gray-50 px-3 py-2"
                        >
                          <div>
                            <p className="text-xs font-medium text-gray-700">{group.label}</p>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {group.components.map((comp) => (
                                <span key={comp.name} className="flex items-center gap-1 text-[10px] text-gray-400">
                                  <StatusDot status={comp.status} />
                                  {comp.name}
                                </span>
                              ))}
                            </div>
                          </div>
                          <StatusBadge status={worstStatus} />
                        </div>
                      );
                    })}
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
