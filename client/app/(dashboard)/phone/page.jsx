'use client';

import { useState, useEffect } from 'react';
import { useAppSelector } from '../../../src/store/hooks';
import {
  useGetAgentsQuery,
  useGetQueueCallsQuery,
  useTransferCallMutation,
  useWarmTransferMutation,
  useCompleteWarmTransferMutation,
} from '../../../src/store/api';

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
  const [transferError, setTransferError] = useState('');
  const [dialingAgent, setDialingAgent] = useState(null);

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
    </div>
  );
}
