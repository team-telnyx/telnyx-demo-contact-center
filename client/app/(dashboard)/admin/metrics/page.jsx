'use client';

import { useState } from 'react';
import { useGetAgentMetricsQuery, useGetCallReportsQuery } from '../../../../src/store/api';

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const s = Math.round(Number(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function DateRangeSelector({ value, onChange }) {
  const ranges = [
    { label: 'Today', key: 'today' },
    { label: 'This Week', key: 'week' },
    { label: 'This Month', key: 'month' },
    { label: 'All Time', key: 'all' },
  ];

  return (
    <div className="flex gap-2">
      {ranges.map((r) => (
        <button key={r.key} onClick={() => onChange(r.key)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === r.key
              ? 'bg-telnyx-green text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

function getDateRange(key) {
  const now = new Date();
  switch (key) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    default:
      return {};
  }
}

export default function MetricsPage() {
  const [dateRange, setDateRange] = useState('all');
  const reportParams = getDateRange(dateRange);

  const { data: metrics, isLoading: metricsLoading } = useGetAgentMetricsQuery(undefined, {
    pollingInterval: 10000,
    refetchOnFocus: true,
    refetchOnMountOrArgChange: true,
  });
  const { data: reports, isLoading: reportsLoading } = useGetCallReportsQuery(reportParams);

  const statusColor = (status) => {
    const map = { online: 'bg-green-500', busy: 'bg-red-500', away: 'bg-yellow-400', break: 'bg-blue-400', dnd: 'bg-purple-500', offline: 'bg-gray-400' };
    return map[status] || 'bg-gray-400';
  };

  const statusBg = (status) => {
    const map = {
      online: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      busy: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      away: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      break: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      dnd: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      offline: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };
    return map[status] || map.offline;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Metrics</h1>
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Agent Status Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Agent Status Overview</h2>
        {metricsLoading ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {Object.entries(metrics?.statusCounts || {}).map(([status, count]) => (
              <div key={status} className={`rounded-lg p-4 text-center ${statusBg(status)}`}>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm font-medium capitalize">{status}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Call Statistics</h2>
        {reportsLoading ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Calls</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{reports?.totalCalls || 0}</p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Duration</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatDuration(reports?.avgDuration)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Wait Time</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatDuration(reports?.avgWaitTime)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Calls by Status */}
      {reports?.callsByStatus?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Calls by Status</h2>
          <div className="flex flex-wrap gap-3">
            {reports.callsByStatus.map((item) => (
              <div key={item.status} className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2">
                <span className="text-sm font-medium capitalize text-gray-600 dark:text-gray-300">{item.status}</span>
                <span className="ml-2 text-lg font-bold text-gray-900 dark:text-white">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calls by Agent */}
      {reports?.callsByAgent?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Calls by Agent</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Agent</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Calls</th>
              </tr>
            </thead>
            <tbody>
              {reports.callsByAgent.map((item) => (
                <tr key={item.agentUsername} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{item.agentUsername || 'Unassigned'}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">{item.callCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Agent Cards */}
      {metrics?.agents?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">All Agents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.agents.map((agent) => (
              <div key={agent.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-telnyx-green text-sm font-semibold text-white">
                    {agent.firstName?.[0]}{agent.lastName?.[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{agent.firstName} {agent.lastName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">@{agent.username}</p>
                  </div>
                  <span className={`h-3 w-3 rounded-full ${statusColor(agent.status)}`} title={agent.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Queue:</span>
                    <span className="ml-1 text-gray-900 dark:text-white">{agent.assignedQueue || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Priority:</span>
                    <span className="ml-1 text-gray-900 dark:text-white">{agent.routingPriority}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Role:</span>
                    <span className="ml-1 text-gray-900 dark:text-white capitalize">{agent.role}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Status:</span>
                    <span className="ml-1 text-gray-900 dark:text-white capitalize">{agent.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
