'use client';

import { useState } from 'react';
import { useGetCallEventsQuery } from '../../../src/store/api';
import { formatPhoneDisplay } from '../../../src/lib/phone-utils';

const EVENT_COLORS = {
  'call.initiated': 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  'call.answered': 'bg-green-500/20 text-green-600 dark:text-green-400',
  'call.hangup': 'bg-red-500/20 text-red-600 dark:text-red-400',
  'call.bridged': 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  'call.enqueued': 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  'call.speak.started': 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  'call.speak.ended': 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400',
  'call.playback.started': 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
  'call.playback.ended': 'bg-cyan-500/10 text-cyan-500 dark:text-cyan-400',
  'call.gather.ended': 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  'call.recording.saved': 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
  'call.dtmf.received': 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
};

function getEventColor(name) {
  return EVENT_COLORS[name] || 'bg-gray-100 text-gray-600';
}

export default function DebugPage() {
  const [filters, setFilters] = useState({
    legId: '', sessionId: '', from: '', to: '', status: '', type: '', dateFrom: '', dateTo: '',
  });
  const [showFilters, setShowFilters] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [page, setPage] = useState(1);

  const { data: eventsData, isLoading, isFetching } = useGetCallEventsQuery({ page, size: 50, ...filters });
  const events = eventsData?.data || [];

  // Group events by call session
  const sessions = {};
  events.forEach((evt) => {
    const sid = evt.call_session_id || evt.call_leg_id || 'unknown';
    if (!sessions[sid]) sessions[sid] = [];
    sessions[sid].push(evt);
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Debug — Call Events</h1>
        <div className="flex items-center gap-2">
          {Object.values(filters).some(Boolean) && (
            <button
              onClick={() => { setFilters({ legId: '', sessionId: '', from: '', to: '', status: '', type: '', dateFrom: '', dateTo: '' }); setPage(1); }}
              className="rounded-btn bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-100"
            >
              Clear filters
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="rounded-btn border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-3">
            {[
              { key: 'from', label: 'From', placeholder: '+1234567890', type: 'tel' },
              { key: 'to', label: 'To', placeholder: '+1234567890', type: 'tel' },
              { key: 'legId', label: 'Call Leg ID', placeholder: 'uuid' },
              { key: 'sessionId', label: 'Session ID', placeholder: 'uuid' },
              { key: 'dateFrom', label: 'From Date', type: 'datetime-local' },
              { key: 'dateTo', label: 'To Date', type: 'datetime-local' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="block text-[10px] font-medium text-gray-400 uppercase mb-0.5">{label}</label>
                <input
                  type={type || 'text'}
                  value={filters[key]}
                  onChange={(e) => { setFilters({ ...filters, [key]: e.target.value }); setPage(1); }}
                  placeholder={placeholder}
                  className="w-40 rounded-btn border border-gray-300 px-2 py-1.5 text-xs font-mono focus:border-telnyx-green focus:outline-none"
                />
              </div>
            ))}
            <div>
              <label className="block text-[10px] font-medium text-gray-400 uppercase mb-0.5">Status</label>
              <select
                value={filters.status}
                onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
                className="w-32 rounded-btn border border-gray-300 px-2 py-1.5 text-xs focus:border-telnyx-green focus:outline-none"
              >
                <option value="">All</option>
                <option value="init">Init</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-400 uppercase mb-0.5">Type</label>
              <select
                value={filters.type}
                onChange={(e) => { setFilters({ ...filters, type: e.target.value }); setPage(1); }}
                className="w-32 rounded-btn border border-gray-300 px-2 py-1.5 text-xs focus:border-telnyx-green focus:outline-none"
              >
                <option value="">All</option>
                <option value="command">Command</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {/* Events list */}
        <div className="flex-1">
          <div className="rounded-card border border-gray-200 bg-white shadow-sm">
            <div className="rounded-t-card bg-black px-4 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-white">Events</h2>
              {isFetching && <div className="h-4 w-4 animate-spin rounded-full border-2 border-telnyx-green border-t-transparent" />}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-telnyx-green border-t-transparent" />
              </div>
            ) : events.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No call events found</div>
            ) : (
              <div className="divide-y max-h-[70vh] overflow-y-auto">
                {events.map((evt, i) => {
                  const isSelected = selectedEvent?.id === evt.id;
                  return (
                    <div
                      key={evt.id || i}
                      onClick={() => setSelectedEvent(isSelected ? null : evt)}
                      className={`px-4 py-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-telnyx-green/5 border-l-2 border-telnyx-green' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getEventColor(evt.name)}`}>
                            {evt.name || 'unknown'}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                            evt.type === 'command' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'
                          }`}>
                            {evt.type || '?'}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {evt.occurred_at ? new Date(evt.occurred_at).toLocaleTimeString() : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                        {evt.from && <span className="font-mono">{formatPhoneDisplay(evt.from)}</span>}
                        {evt.from && evt.to && <span>→</span>}
                        {evt.to && <span className="font-mono">{formatPhoneDisplay(evt.to)}</span>}
                        {evt.status && (
                          <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                            evt.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                            evt.status === 'in_progress' ? 'bg-yellow-500/10 text-yellow-500' :
                            'bg-gray-500/10 text-gray-500'
                          }`}>
                            {evt.status}
                          </span>
                        )}
                      </div>
                      {evt.call_session_id && (
                        <div className="mt-1 text-[9px] text-gray-300 font-mono truncate">
                          Session: {evt.call_session_id}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-btn border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-gray-400">Page {page}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={events.length < 50}
                className="rounded-btn border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Event detail panel */}
        <div className="w-96 flex-shrink-0">
          <div className="sticky top-0 rounded-card border border-gray-200 bg-white shadow-sm">
            <div className="rounded-t-card bg-black px-4 py-3">
              <h2 className="font-semibold text-white">Event Detail</h2>
            </div>
            {selectedEvent ? (
              <div className="max-h-[70vh] overflow-y-auto">
                {/* Summary */}
                <div className="border-b border-gray-100 px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getEventColor(selectedEvent.name)}`}>
                      {selectedEvent.name}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                      selectedEvent.type === 'command' ? 'bg-blue-50 text-blue-500' : 'bg-green-50 text-green-500'
                    }`}>
                      {selectedEvent.type}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-gray-400">Time</span>
                      <p className="font-mono text-gray-700 dark:text-gray-300">{selectedEvent.occurred_at ? new Date(selectedEvent.occurred_at).toLocaleString() : '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Status</span>
                      <p className="font-mono text-gray-700 dark:text-gray-300">{selectedEvent.status || '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">From</span>
                      <p className="font-mono text-gray-700 dark:text-gray-300">{selectedEvent.from ? formatPhoneDisplay(selectedEvent.from) : '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">To</span>
                      <p className="font-mono text-gray-700 dark:text-gray-300">{selectedEvent.to ? formatPhoneDisplay(selectedEvent.to) : '—'}</p>
                    </div>
                  </div>
                </div>

                {/* IDs */}
                <div className="border-b border-gray-100 px-4 py-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-gray-400">Identifiers</p>
                  {[
                    ['Call Leg ID', selectedEvent.call_leg_id],
                    ['Call Session ID', selectedEvent.call_session_id],
                    ['Connection ID', selectedEvent.connection_id],
                  ].map(([label, val]) => val && (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">{label}</span>
                      <span className="font-mono text-[10px] text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Raw payload */}
                <div className="px-4 py-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400 mb-2">Raw Payload</p>
                  <pre className="rounded-btn bg-gray-950 p-3 text-[10px] text-green-400 font-mono overflow-x-auto max-h-80 whitespace-pre-wrap">
                    {JSON.stringify(selectedEvent, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="px-4 py-12 text-center text-sm text-gray-400">
                Click an event to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
