'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useGetAgentMetricsQuery,
  useGetCallReportsQuery,
  useGetOrgSettingsQuery,
  useUpdateOrgSettingsMutation,
} from '../../../src/store/api';

function StatusCard({ label, value, color }) {
  const colorMap = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };
  return (
    <div className={`rounded-lg p-4 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const s = Math.round(Number(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function OrgSettingsPanel() {
  const { data: settings, isLoading } = useGetOrgSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] = useUpdateOrgSettingsMutation();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const currentForm = form || {
    orgTelnyxApiKey: '',
    orgTelnyxPublicKey: settings?.orgTelnyxPublicKey || '',
  };

  const handleSave = async () => {
    setSaveError('');
    try {
      const payload = { ...currentForm };
      if (!payload.orgTelnyxApiKey) delete payload.orgTelnyxApiKey;
      const result = await updateSettings(payload).unwrap();
      setSaved(true);
      setForm(null);
      setTimeout(() => setSaved(false), 5000);
    } catch (err) {
      setSaveError(err.data?.error || 'Failed to save settings');
    }
  };

  if (isLoading) return <div className="text-gray-500">Loading settings...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-1 text-gray-900 dark:text-white">Organization Telnyx Settings</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Setting the API key will automatically create a Voice App and SIP Connection for the contact center.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            API Key {settings?.orgTelnyxApiKey && <span className="text-xs text-gray-400">(current: {settings.orgTelnyxApiKey})</span>}
          </label>
          <input
            type="password"
            placeholder="Enter API key (v2)"
            value={currentForm.orgTelnyxApiKey}
            onChange={(e) => setForm({ ...currentForm, orgTelnyxApiKey: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Public Key</label>
          <input
            placeholder="Public key for webhook signature verification"
            value={currentForm.orgTelnyxPublicKey}
            onChange={(e) => setForm({ ...currentForm, orgTelnyxPublicKey: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Status info */}
        <div className="rounded-md bg-gray-50 dark:bg-gray-700/50 p-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">API Key</span>
            <span className={`font-medium ${settings?.orgTelnyxApiKey ? 'text-green-600 dark:text-green-400' : 'text-yellow-500'}`}>
              {settings?.orgTelnyxApiKey ? 'Configured' : 'Not set'}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Public Key</span>
            <span className={`font-medium ${settings?.orgTelnyxPublicKey ? 'text-green-600 dark:text-green-400' : 'text-yellow-500'}`}>
              {settings?.orgTelnyxPublicKey ? 'Configured' : 'Not set'}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
            Voice App and SIP connections are auto-provisioned per agent on registration.
          </p>
        </div>

        {saveError && <div className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-300">{saveError}</div>}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-telnyx-green px-4 py-2 text-sm font-medium text-white hover:bg-telnyx-green-light disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && <span className="text-sm text-green-600 dark:text-green-400">Settings saved!</span>}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: metrics, isLoading: metricsLoading } = useGetAgentMetricsQuery(undefined, { pollingInterval: 30000 });
  const { data: reports, isLoading: reportsLoading } = useGetCallReportsQuery({});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>

      {/* Status Overview Cards */}
      {metricsLoading ? (
        <div className="text-gray-500">Loading metrics...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusCard label="Online Agents" value={metrics?.statusCounts?.online || 0} color="green" />
          <StatusCard label="Busy" value={metrics?.statusCounts?.busy || 0} color="red" />
          <StatusCard label="Away" value={metrics?.statusCounts?.away || 0} color="yellow" />
          <StatusCard label="Total Agents" value={metrics?.totalAgents || 0} color="blue" />
        </div>
      )}

      {/* Quick Links */}
      <div className="flex gap-4">
        <Link href="/admin/users" className="rounded-lg bg-telnyx-green px-4 py-2.5 font-semibold text-white transition-colors hover:bg-telnyx-green-light">
          Manage Users
        </Link>
        <Link href="/admin/metrics" className="rounded-lg border border-telnyx-green px-4 py-2.5 font-semibold text-telnyx-green transition-colors hover:bg-telnyx-green hover:text-white">
          View Metrics
        </Link>
      </div>

      {/* Organization Settings */}
      <OrgSettingsPanel />

      {/* Recent Call Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Call Summary</h2>
        {reportsLoading ? (
          <div className="text-gray-500">Loading reports...</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Calls</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{reports?.totalCalls || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Duration</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatDuration(reports?.avgDuration)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Wait Time</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatDuration(reports?.avgWaitTime)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Agent List Preview */}
      {metrics?.agents?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Agent Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.agents.slice(0, 6).map((agent) => (
              <div key={agent.id} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-telnyx-green text-sm font-semibold text-white">
                  {agent.firstName?.[0]}{agent.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{agent.firstName} {agent.lastName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{agent.assignedQueue || 'No queue'}</p>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${
                  agent.status === 'online' ? 'bg-green-500' :
                  agent.status === 'busy' ? 'bg-red-500' :
                  agent.status === 'away' ? 'bg-yellow-400' :
                  'bg-gray-400'
                }`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
