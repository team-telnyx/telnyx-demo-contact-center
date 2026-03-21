'use client';

import { useState } from 'react';
import { useGetCallHistoryQuery } from '../../../src/store/api';
import { useAppSelector } from '../../../src/store/hooks';

function formatDuration(seconds) {
  if (seconds == null) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }) {
  const colorMap = {
    completed: 'bg-green-100 text-green-800',
    active: 'bg-yellow-100 text-yellow-800',
    missed: 'bg-red-100 text-red-800',
    failed: 'bg-red-100 text-red-800',
    queued: 'bg-gray-100 text-gray-800',
    ringing: 'bg-blue-100 text-blue-800',
  };
  const classes = colorMap[status] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${classes}`}>
      {status}
    </span>
  );
}

function DirectionIcon({ direction }) {
  if (direction === 'inbound') {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-green-100 p-1" title="Inbound">
        <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-blue-100 p-1" title="Outbound">
      <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </span>
  );
}

export default function HistoryPage() {
  const { token } = useAppSelector((state) => state.auth);
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const limit = 50;

  const { data, isLoading, isFetching } = useGetCallHistoryQuery(
    { page, limit, direction: direction || undefined, status: status || undefined },
    { skip: !token }
  );

  const records = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 50 };
  const totalPages = Math.ceil(meta.total / meta.limit) || 1;

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Call History</h1>
        <p className="mt-1 text-sm text-gray-500">View and filter call detail records</p>
      </div>

      {/* Filter Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div>
          <label htmlFor="direction-filter" className="mr-2 text-sm font-medium text-gray-700">
            Direction:
          </label>
          <select
            id="direction-filter"
            value={direction}
            onChange={(e) => { setDirection(e.target.value); setPage(1); }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
          >
            <option value="">All</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </div>
        <div>
          <label htmlFor="status-filter" className="mr-2 text-sm font-medium text-gray-700">
            Status:
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
          >
            <option value="">All</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        {isFetching && (
          <span className="text-xs text-gray-400">Updating...</span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-telnyx-green"></div>
              <p className="text-sm text-gray-500">Loading call records...</p>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <svg className="mx-auto mb-3 h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-gray-900">No call records found</p>
              <p className="mt-1 text-xs text-gray-500">Try adjusting your filters</p>
            </div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Direction</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">From</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">To</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3">
                    <DirectionIcon direction={record.direction} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{record.fromNumber}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{record.toNumber}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-700">{formatDuration(record.durationSeconds)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{formatDate(record.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {records.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{(meta.page - 1) * meta.limit + 1}</span> to{' '}
            <span className="font-medium">{Math.min(meta.page * meta.limit, meta.total)}</span> of{' '}
            <span className="font-medium">{meta.total}</span> results
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="flex items-center px-3 text-sm text-gray-700">
              Page {meta.page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
