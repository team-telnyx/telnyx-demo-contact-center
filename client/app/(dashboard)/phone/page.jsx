'use client';

import { useState, useEffect } from 'react';
import { useAppSelector } from '../../../src/store/hooks';
import {
  useGetAgentsQuery,
  useGetQueueCallsQuery,
  useTransferCallMutation,
  useWarmTransferMutation,
  useCompleteWarmTransferMutation,
  useGetRecordingsQuery,
  useDeleteRecordingMutation,
} from '../../../src/store/api';
import { formatPhoneDisplay } from '../../../src/lib/phone-utils';
import WaveformPlayer from '../../components/WaveformPlayer';

export default function PhonePage() {
  const { username } = useAppSelector((state) => state.auth);
  const {
    callState,
    callerInfo,
    outboundCCID,
    webrtcOutboundCCID,
    callControlId,
    warmTransferActive,
    warmTransferError,
  } = useAppSelector((state) => state.call);

  const { data: agents, refetch: refetchAgents } = useGetAgentsQuery(undefined, {
    pollingInterval: 10000,
  });
  const { data: queueData, refetch: refetchQueue } = useGetQueueCallsQuery(undefined, {
    pollingInterval: 5000,
  });

  const [transferCall] = useTransferCallMutation();
  const [warmTransfer] = useWarmTransferMutation();
  const [completeWarmTransfer] = useCompleteWarmTransferMutation();
  const [recFilters, setRecFilters] = useState({ from: '', to: '', dateFrom: '', dateTo: '', callSessionId: '', callLegId: '', callControlId: '', conferenceId: '', sipCallId: '', connectionId: '' });
  const [recSort, setRecSort] = useState({ key: 'created_at', dir: 'desc' });
  const { data: recordingsData } = useGetRecordingsQuery({
    page: 1, size: 50,
    from: recFilters.from || undefined,
    to: recFilters.to || undefined,
    dateFrom: recFilters.dateFrom || undefined,
    dateTo: recFilters.dateTo || undefined,
  });
  const [deleteRecording] = useDeleteRecordingMutation();
  const [transferError, setTransferError] = useState('');
  const [dialingAgent, setDialingAgent] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [showRecFilters, setShowRecFilters] = useState(false);

  // Sort recordings client-side
  const recordings = [...(recordingsData?.data || [])].sort((a, b) => {
    let aVal, bVal;
    if (recSort.key === 'created_at') {
      aVal = new Date(a.created_at || 0).getTime();
      bVal = new Date(b.created_at || 0).getTime();
    } else if (recSort.key === 'duration') {
      aVal = a.duration_millis || 0;
      bVal = b.duration_millis || 0;
    } else if (recSort.key === 'from') {
      aVal = a.from || '';
      bVal = b.from || '';
    } else if (recSort.key === 'to') {
      aVal = a.to || '';
      bVal = b.to || '';
    } else {
      return 0;
    }
    return recSort.dir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const toggleRecSort = (key) => {
    setRecSort((prev) => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  const SortIcon = ({ field }) => (
    <span className="ml-0.5 text-[8px]">
      {recSort.key === field ? (recSort.dir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );

  const filteredAgents = agents?.filter((a) => a.username !== username) || [];
  const queueCalls = queueData?.data || [];
  const isActive = callState === 'ACTIVE';

  useEffect(() => {
    if (callControlId) {
      refetchAgents();
      refetchQueue();
    }
  }, [callControlId, refetchAgents, refetchQueue]);

  // Clear dialing state when warm transfer resolves (answered or failed)
  useEffect(() => {
    if (warmTransferActive || warmTransferError) {
      setDialingAgent(null);
    }
  }, [warmTransferActive, warmTransferError]);

  const handleTransfer = async (agentUsername) => {
    setTransferError('');
    try {
      await transferCall({
        sipUsername: agentUsername,
        callerId: callerInfo,
        callControlId,
        outboundCCID,
      }).unwrap();
    } catch (err) {
      const msg = err?.data?.error || err?.data || 'Transfer failed';
      setTransferError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setTimeout(() => setTransferError(''), 8000);
    }
  };

  // Warm Transfer: Dial target agent with supervisor barge on the PSTN leg
  const handleWarmTransfer = async (agentUsername) => {
    setTransferError('');
    setDialingAgent(agentUsername);
    try {
      await warmTransfer({
        sipUsername: agentUsername,
        callControlId,
        webrtcOutboundCCID,
        outboundCCID,
        callerId: callerInfo,
      }).unwrap();
    } catch (err) {
      const msg = err?.data?.error || 'Warm transfer failed';
      setTransferError(msg);
      setDialingAgent(null);
      setTimeout(() => setTransferError(''), 8000);
    }
  };

  // Complete: Agent hangs up their leg, leaving PSTN + target agent
  const handleCompleteWarmTransfer = async () => {
    await completeWarmTransfer({
      callControlId,
      outboundCCID,
      webrtcOutboundCCID,
    });
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">Phone Page</h1>
      <hr className="mb-6 border-gray-200" />

      {/* Active call info banner */}
      {['ACTIVE', 'DIALING', 'INCOMING'].includes(callState) && (
        <div className="mb-6 flex items-center justify-between rounded-card bg-black px-5 py-3 text-white">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${callState === 'ACTIVE' ? 'bg-telnyx-green-vibrant' : 'bg-yellow-400 status-pulse'}`} />
            <span className="text-sm font-medium">
              {callState === 'INCOMING' ? 'Incoming Call' : callState === 'DIALING' ? 'Dialing...' : 'Active Call'}
              {callerInfo?.number && <span className="ml-2 font-mono text-gray-300">{callerInfo.number}</span>}
            </span>
            {dialingAgent && !warmTransferActive && (
              <span className="ml-2 rounded-full bg-yellow-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider animate-pulse">
                Dialing {dialingAgent}...
              </span>
            )}
            {warmTransferActive && (
              <span className="ml-2 rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                3-Way Active
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">
            Use the Softphone in the header for call controls
          </span>
        </div>
      )}

      {(transferError || warmTransferError) && (
        <div className="mb-4 rounded-btn bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">
          {transferError || warmTransferError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Queue Table */}
        <div className="rounded-card border border-gray-200 bg-white shadow-sm hover-lift">
          <div className="rounded-t-card bg-black px-4 py-3">
            <h2 className="font-semibold text-white">Queue Table</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Wait Time (seconds)</th>
                  <th className="px-4 py-3">Queue Position</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {queueCalls.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                      No calls in queue
                    </td>
                  </tr>
                ) : (
                  queueCalls.map((call, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{call.from}</td>
                      <td className="px-4 py-3 font-mono text-xs">{call.to}</td>
                      <td className="px-4 py-3">{call.wait_time_secs}</td>
                      <td className="px-4 py-3">{call.queue_position}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">
                          Routing...
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Agent Dashboard */}
        <div className="rounded-card border border-gray-200 bg-white shadow-sm hover-lift">
          <div className="rounded-t-card bg-black px-4 py-3">
            <h2 className="font-semibold text-white">Agent Dashboard</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">First Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Call Function</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                      No other agents
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{agent.username}</td>
                      <td className="px-4 py-3">{agent.firstName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${
                            agent.status === 'online' ? 'bg-telnyx-green' : agent.status === 'away' ? 'bg-yellow-400' : agent.status === 'busy' || agent.status === 'dnd' ? 'bg-red-500' : 'bg-gray-400'
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => handleTransfer(agent.username)}
                            disabled={!isActive || agent.status !== 'online' || warmTransferActive}
                            className="rounded-btn bg-telnyx-green px-2 py-1 text-xs font-semibold text-white hover:bg-[#008c69] disabled:opacity-40"
                          >
                            Transfer
                          </button>
                          <button
                            onClick={() => handleWarmTransfer(agent.username)}
                            disabled={!isActive || agent.status !== 'online' || warmTransferActive}
                            className="rounded-btn bg-purple-600 px-2 py-1 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-40"
                          >
                            Warm Transfer
                          </button>
                          <button
                            onClick={handleCompleteWarmTransfer}
                            disabled={!warmTransferActive}
                            className="rounded-btn bg-orange-500 px-2 py-1 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
                          >
                            Complete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recordings */}
      <div className="mt-6 rounded-card border border-gray-200 bg-white shadow-sm hover-lift">
        <div className="flex items-center justify-between rounded-t-card bg-black px-4 py-3">
          <h2 className="font-semibold text-white">Recordings</h2>
          <div className="flex items-center gap-2">
            {Object.values(recFilters).some(Boolean) && (
              <button onClick={() => setRecFilters({ from: '', to: '', dateFrom: '', dateTo: '', callSessionId: '', callLegId: '', callControlId: '', conferenceId: '', sipCallId: '', connectionId: '' })}
                className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-500/30">
                Clear filters
              </button>
            )}
            <button onClick={() => setShowRecFilters(!showRecFilters)}
              className={`rounded-btn px-3 py-1 text-xs font-medium transition-colors ${
                showRecFilters ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
              }`}>
              Filters {showRecFilters ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {showRecFilters && (
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'from', label: 'From Number', placeholder: '+1234567890', type: 'tel' },
                { key: 'to', label: 'To Number', placeholder: '+1234567890', type: 'tel' },
                { key: 'dateFrom', label: 'Date From', type: 'date' },
                { key: 'dateTo', label: 'Date To', type: 'date' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-[10px] font-medium text-gray-400 uppercase mb-0.5">{label}</label>
                  <input type={type} value={recFilters[key]} onChange={(e) => setRecFilters({ ...recFilters, [key]: e.target.value })}
                    placeholder={placeholder} className="w-36 rounded-btn border border-gray-300 px-2 py-1 text-xs font-mono focus:border-telnyx-green focus:outline-none" />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'callSessionId', label: 'Call Session ID', placeholder: 'uuid' },
                { key: 'callLegId', label: 'Call Leg ID', placeholder: 'uuid' },
                { key: 'callControlId', label: 'Call Control ID', placeholder: 'v3:...' },
                { key: 'conferenceId', label: 'Conference ID', placeholder: 'uuid' },
                { key: 'sipCallId', label: 'SIP Call ID', placeholder: 'sip-id' },
                { key: 'connectionId', label: 'Connection ID', placeholder: 'id' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-[10px] font-medium text-gray-400 uppercase mb-0.5">{label}</label>
                  <input type="text" value={recFilters[key]} onChange={(e) => setRecFilters({ ...recFilters, [key]: e.target.value })}
                    placeholder={placeholder} className="w-36 rounded-btn border border-gray-300 px-2 py-1 text-xs font-mono focus:border-telnyx-green focus:outline-none" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-gray-700" onClick={() => toggleRecSort('created_at')}>
                  Date <SortIcon field="created_at" />
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-gray-700" onClick={() => toggleRecSort('from')}>
                  From <SortIcon field="from" />
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-gray-700" onClick={() => toggleRecSort('to')}>
                  To <SortIcon field="to" />
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-gray-700" onClick={() => toggleRecSort('duration')}>
                  Duration <SortIcon field="duration" />
                </th>
                <th className="px-4 py-3">Channels</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recordings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    No recordings found
                  </td>
                </tr>
              ) : (
                recordings.map((rec) => {
                  const dur = rec.duration_millis ? Math.round(rec.duration_millis / 1000) : 0;
                  const mins = Math.floor(dur / 60);
                  const secs = dur % 60;
                  const isExpanded = activePlayer === rec.id;
                  const audioUrl = rec.download_urls?.mp3 || rec.download_urls?.wav;
                  return (
                    <tr key={rec.id} className="group">
                      <td colSpan={6} className="p-0">
                        {/* Row */}
                        <div className="flex items-center hover:bg-gray-50 cursor-pointer" onClick={() => audioUrl && setActivePlayer(isExpanded ? null : rec.id)}>
                          <div className="px-4 py-3 text-xs text-gray-500 w-[18%]">
                            {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : '—'}
                            <div className="text-[10px] text-gray-400">{rec.created_at ? new Date(rec.created_at).toLocaleTimeString() : ''}</div>
                          </div>
                          <div className="px-4 py-3 font-mono text-xs w-[18%]">
                            {rec.from ? formatPhoneDisplay(rec.from) : '—'}
                          </div>
                          <div className="px-4 py-3 font-mono text-xs w-[18%]">
                            {rec.to ? formatPhoneDisplay(rec.to) : '—'}
                          </div>
                          <div className="px-4 py-3 text-xs w-[12%]">
                            {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
                          </div>
                          <div className="px-4 py-3 text-xs text-gray-500 w-[10%]">
                            {rec.channels || '—'}
                          </div>
                          <div className="px-4 py-3 w-[24%]">
                            <div className="flex gap-1.5">
                              {audioUrl && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setActivePlayer(isExpanded ? null : rec.id); }}
                                  className={`rounded-btn px-2 py-1 text-xs font-semibold transition-colors ${
                                    isExpanded
                                      ? 'bg-gray-900 text-white'
                                      : 'bg-telnyx-green text-white hover:bg-[#008c69]'
                                  }`}
                                >
                                  {isExpanded ? 'Close' : 'Play'}
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this recording?')) deleteRecording(rec.id); }}
                                className="rounded-btn border border-red-200 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                        {/* Expanded waveform player — full width */}
                        {isExpanded && audioUrl && (
                          <div className="pb-4 px-0">
                            <WaveformPlayer src={audioUrl} onClose={() => setActivePlayer(null)} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
