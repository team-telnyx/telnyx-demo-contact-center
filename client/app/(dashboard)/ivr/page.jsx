'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, {
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes, NODE_PALETTE, createNode } from './nodeTypes';
import {
  useGetIvrFlowsQuery,

  useCreateIvrFlowMutation,
  useUpdateIvrFlowMutation,
  useDeleteIvrFlowMutation,
  usePublishIvrFlowMutation,
  useUnpublishIvrFlowMutation,
  useGetConnectionNumbersQuery,
  useGetVoicesQuery,
  useGetAudioFilesQuery,
} from '../../../src/store/api';
import { formatPhoneDisplay } from '../../../src/lib/phone-utils';

const CATEGORY_COLORS = {
  trigger: '#00a37a',
  action: '#2563eb',
  media: '#9333ea',
  routing: '#d97706',
  recording: '#e11d48',
  streaming: '#0891b2',
  ai: '#6366f1',
  conference: '#db2777',
  end: '#dc2626',
};

let idCounter = 100;
function getId() { return `node_${idCounter++}`; }

export default function IVRBuilderPage() {
  const router = useRouter();
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [urlModeFields, setUrlModeFields] = useState({});

  // Flow management state
  const [currentFlowId, setCurrentFlowId] = useState(null);
  const [flowName, setFlowName] = useState('Untitled Flow');
  const [flowDescription, setFlowDescription] = useState('');
  const [publishNumber, setPublishNumber] = useState('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishTargetId, setPublishTargetId] = useState(null);
  const [currentFlowPhone, setCurrentFlowPhone] = useState(null);
  const [flowActive, setFlowActive] = useState(false);
  const [flowHasDraft, setFlowHasDraft] = useState(false);
  const [, setFlowPublishedAt] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showFlowList, setShowFlowList] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // API hooks
  const { data: flows = [], isLoading: flowsLoading, refetch: refetchFlows } = useGetIvrFlowsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const [createFlow, { isLoading: creating }] = useCreateIvrFlowMutation();
  const [updateFlow, { isLoading: updating }] = useUpdateIvrFlowMutation();
  const [deleteFlow] = useDeleteIvrFlowMutation();
  const [publishFlow] = usePublishIvrFlowMutation();
  const [unpublishFlow] = useUnpublishIvrFlowMutation();
  const { data: voicesData = {} } = useGetVoicesQuery();
  const { data: connectionNumbers = [], isLoading: numbersLoading } = useGetConnectionNumbersQuery();
  const { data: audioFilesData } = useGetAudioFilesQuery();
  const audioFiles = audioFilesData?.files || [];

  const onConnect = useCallback(
    (params) => { setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#666' } }, eds)); setHasUnsavedChanges(true); },
    [setEdges]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('application/reactflow');
      if (!raw) return;
      const { type } = JSON.parse(raw);
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setNodes((nds) => nds.concat(createNode(getId(), type, position)));
      setHasUnsavedChanges(true);
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeClick = useCallback((_, node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const updateNodeData = useCallback((id, key, value) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n))
    );
    setSelectedNode((prev) => prev && prev.id === id ? { ...prev, data: { ...prev.data, [key]: value } } : prev);
  }, [setNodes]);

  const deleteNode = useCallback((id) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  // ── Save flow ──
  const handleSave = async () => {
    setMsg({ type: '', text: '' });
    const flowData = { nodes, edges };
    try {
      if (currentFlowId) {
        await updateFlow({ id: currentFlowId, name: flowName, description: flowDescription, flowData }).unwrap();
        setHasUnsavedChanges(false);
        if (flowActive) setFlowHasDraft(true);
        setMsg({ type: 'success', text: flowActive ? 'Draft saved — publish to push live' : 'Flow saved' });
      } else {
        const result = await createFlow({ name: flowName, description: flowDescription, flowData }).unwrap();
        setCurrentFlowId(result.id);
        setHasUnsavedChanges(false);
        setMsg({ type: 'success', text: 'Flow created' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err?.data?.error || 'Failed to save' });
    }
  };

  // ── Load flow ──
  const handleLoadFlow = async (flow) => {
    setCurrentFlowId(flow.id);
    setFlowName(flow.name);
    setFlowDescription(flow.description || '');
    setCurrentFlowPhone(flow.phoneNumber || null);
    setFlowActive(!!flow.active);
    setFlowHasDraft(!!flow.hasDraft);
    setFlowPublishedAt(flow.publishedAt || null);
    setHasUnsavedChanges(false);
    // Fetch full flow data
    try {
      const res = await fetch(
        `/api/ivr/${flow.id}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      if (res.status === 401) {
        localStorage.removeItem('token');
        router.push('/login');
        return;
      }
      const full = await res.json();
      // Handle flowData whether it comes as a string or parsed object
      let flowData;
      try {
        flowData = typeof full.flowData === 'string' ? JSON.parse(full.flowData) : full.flowData;
      } catch (parseErr) {
        console.error('Error parsing flowData:', parseErr.message);
        flowData = null;
      }
      if (flowData?.nodes) {
        setNodes(flowData.nodes);
        setEdges(flowData.edges || []);
      }
    } catch (err) {
      console.error('Error loading flow:', err.message || err);
    }
    setShowFlowList(false);
    setMsg({ type: '', text: '' });
  };

  // ── New flow ──
  const handleNewFlow = () => {
    setCurrentFlowId(null);
    setFlowName('Untitled Flow');
    setFlowDescription('');
    setCurrentFlowPhone(null);
    setFlowActive(false);
    setFlowHasDraft(false);
    setFlowPublishedAt(null);
    setHasUnsavedChanges(false);
    setNodes([]);
    setEdges([]);
    setShowFlowList(false);
    setSelectedNode(null);
    setMsg({ type: '', text: '' });
  };

  // ── Delete flow ──
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this flow?')) return;
    try {
      await deleteFlow(id).unwrap();
      if (currentFlowId === id) handleNewFlow();
    } catch { /* noop */ }
  };

  // ── Publish (from modal) ──
  const handlePublish = async () => {
    const targetId = publishTargetId || currentFlowId;
    if (!publishNumber || !targetId) return;
    try {
      // Save draft first if this is the currently edited flow with unsaved changes
      if (targetId === currentFlowId && hasUnsavedChanges) {
        await updateFlow({ id: currentFlowId, name: flowName, description: flowDescription, flowData: { nodes, edges } }).unwrap();
      }
      await publishFlow({ id: targetId, phoneNumber: publishNumber }).unwrap();
      setShowPublishModal(false);
      setPublishTargetId(null);
      // Update editor state if this was the current flow
      if (targetId === currentFlowId) {
        setCurrentFlowPhone(publishNumber);
        setFlowActive(true);
        setFlowHasDraft(false);
        setHasUnsavedChanges(false);
        setFlowPublishedAt(new Date().toISOString());
      }
      setPublishNumber('');
      refetchFlows();
      setMsg({ type: 'success', text: `Published to ${formatPhoneDisplay(publishNumber)}` });
    } catch (err) {
      setMsg({ type: 'error', text: err?.data?.error || 'Failed to publish' });
    }
  };

  // ── Unpublish ──
  const handleUnpublish = async (id) => {
    try {
      await unpublishFlow(id).unwrap();
      // Update editor state if this was the current flow
      if (id === currentFlowId) {
        setFlowActive(false);
        setFlowPublishedAt(null);
      }
    } catch { /* noop */ }
  };

  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  // ── Flow list view ──
  if (showFlowList) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">IVR Flows</h1>
          <button
            onClick={handleNewFlow}
            className="flex items-center gap-1.5 rounded-btn bg-telnyx-green px-4 py-2 text-sm font-medium text-white hover:bg-telnyx-green/90"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Flow
          </button>
        </div>

        {flowsLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-telnyx-green border-t-transparent" />
          </div>
        ) : flows.length === 0 ? (
          <div className="rounded-card border border-gray-200 bg-white p-12 text-center shadow-sm">
            <svg className="mx-auto mb-3 h-12 w-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
            </svg>
            <p className="text-gray-500">No IVR flows yet. Create your first one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {flows.map((flow) => (
              <div
                key={flow.id}
                className={`rounded-card border-2 bg-white shadow-sm hover-lift ${
                  flow.active ? 'border-telnyx-green' : 'border-gray-200'
                }`}
              >
                {/* Status bar */}
                {flow.active && (
                  <div className={`flex items-center justify-between rounded-t-[14px] px-4 py-2 ${flow.hasDraft ? 'bg-yellow-500' : 'bg-telnyx-green'}`}>
                    <div className="flex items-center gap-2 text-white">
                      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {flow.hasDraft ? 'Live — Draft Available' : 'Live'}
                      </span>
                    </div>
                    <span className="rounded bg-white/20 px-2 py-0.5 font-mono text-xs text-white">
                      {formatPhoneDisplay(flow.phoneNumber)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex-1 cursor-pointer" onClick={() => handleLoadFlow(flow)}>
                    <h3 className="text-sm font-semibold text-gray-900">{flow.name}</h3>
                    {flow.description && <p className="mt-0.5 text-xs text-gray-400">{flow.description}</p>}
                    {flow.active && flow.phoneNumber && (
                      <p className="mt-1 text-[10px] text-telnyx-green font-medium">
                        Published to {formatPhoneDisplay(flow.phoneNumber)}
                        {flow.publishedAt && ` — ${new Date(flow.publishedAt).toLocaleDateString()}`}
                      </p>
                    )}
                    {!flow.active && flow.phoneNumber && (
                      <p className="mt-1 text-[10px] text-gray-300">
                        Last published to {formatPhoneDisplay(flow.phoneNumber)} (inactive)
                      </p>
                    )}
                    {!flow.phoneNumber && (
                      <p className="mt-1 text-[10px] text-gray-300">Not assigned to any number</p>
                    )}
                    <p className="mt-0.5 text-[10px] text-gray-300">Updated {new Date(flow.updatedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {flow.active ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUnpublish(flow.id); }}
                        className="rounded-btn border border-orange-200 px-3 py-1.5 text-xs font-medium text-orange-500 hover:bg-orange-50"
                      >
                        Unpublish
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPublishTargetId(flow.id);
                          setPublishNumber(flow.phoneNumber || '');
                          setShowPublishModal(true);
                        }}
                        className="rounded-btn bg-telnyx-green px-3 py-1.5 text-xs font-medium text-white hover:bg-telnyx-green/90"
                      >
                        Publish
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLoadFlow(flow); }}
                      className="rounded-btn border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(flow.id); }}
                      className="rounded-btn border border-red-200 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      {/* Publish Modal (shared) */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Publish Flow</h3>
            <p className="text-xs text-gray-500 mb-3">
              Assign this IVR flow to a phone number. When that number receives a call, this flow will execute instead of the default queue behavior.
            </p>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number</label>
            {numbersLoading ? (
              <div className="flex items-center gap-2 mb-4 text-xs text-gray-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-telnyx-green border-t-transparent" />
                Loading numbers...
              </div>
            ) : connectionNumbers.length === 0 ? (
              <p className="text-xs text-red-400 mb-4">No phone numbers assigned to the voice connection.</p>
            ) : (
              <select
                value={publishNumber}
                onChange={(e) => setPublishNumber(e.target.value)}
                className="w-full rounded-btn border border-gray-300 px-3 py-2 text-sm font-mono focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green mb-4"
              >
                <option value="">Select a number...</option>
                {connectionNumbers.map((n) => (
                  <option key={n.id} value={n.phone_number}>
                    {formatPhoneDisplay(n.phone_number)}
                  </option>
                ))}
              </select>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowPublishModal(false); setPublishTargetId(null); }}
                className="rounded-btn border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handlePublish} disabled={!publishNumber}
                className="rounded-btn bg-telnyx-green px-4 py-2 text-sm font-medium text-white hover:bg-telnyx-green/90 disabled:opacity-50">
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

  // ── Editor view ──
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={async () => { await refetchFlows(); setShowFlowList(true); }}
            className="rounded-btn border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            ← All Flows
          </button>
          <input
            type="text"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="rounded-btn border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-900 focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
            placeholder="Flow name"
          />
          <input
            type="text"
            value={flowDescription}
            onChange={(e) => setFlowDescription(e.target.value)}
            className="rounded-btn border border-gray-200 px-3 py-1.5 text-xs text-gray-500 focus:border-telnyx-green focus:outline-none"
            placeholder="Description (optional)"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          {currentFlowId && (
            flowActive && !flowHasDraft && !hasUnsavedChanges ? (
              <span className="rounded-full bg-telnyx-green/10 px-2.5 py-0.5 text-[10px] font-semibold text-telnyx-green">
                Live
              </span>
            ) : flowActive && (flowHasDraft || hasUnsavedChanges) ? (
              <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-[10px] font-semibold text-yellow-700">
                {hasUnsavedChanges ? 'Unsaved changes' : 'Unpublished draft'}
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-500">
                Draft
              </span>
            )
          )}

          {msg.text && (
            <span className={`text-xs ${msg.type === 'error' ? 'text-red-500' : 'text-telnyx-green'}`}>
              {msg.text}
            </span>
          )}

          {/* Save (always available) */}
          <button
            onClick={handleSave}
            disabled={creating || updating}
            className="rounded-btn bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {creating || updating ? 'Saving...' : 'Save Draft'}
          </button>

          {currentFlowId && (() => {
            // Active with no changes → Unpublish
            if (flowActive && !flowHasDraft && !hasUnsavedChanges) {
              return (
                <button
                  onClick={async () => {
                    try {
                      await unpublishFlow(currentFlowId).unwrap();
                      setFlowActive(false);
                      setFlowPublishedAt(null);
                      refetchFlows();
                      setMsg({ type: 'success', text: 'Flow unpublished' });
                    } catch (err) {
                      setMsg({ type: 'error', text: err?.data?.error || 'Failed to unpublish' });
                    }
                  }}
                  className="rounded-btn border border-orange-300 px-4 py-1.5 text-xs font-medium text-orange-500 hover:bg-orange-50"
                >
                  Unpublish
                </button>
              );
            }
            // Has draft changes → Publish
            if (flowActive && (flowHasDraft || hasUnsavedChanges)) {
              return (
                <button
                  onClick={async () => {
                    try {
                      // Save first if unsaved
                      if (hasUnsavedChanges) {
                        await updateFlow({ id: currentFlowId, name: flowName, description: flowDescription, flowData: { nodes, edges } }).unwrap();
                      }
                      await publishFlow({ id: currentFlowId, phoneNumber: currentFlowPhone }).unwrap();
                      setFlowHasDraft(false);
                      setHasUnsavedChanges(false);
                      setFlowActive(true);
                      setFlowPublishedAt(new Date().toISOString());
                      refetchFlows();
                      setMsg({ type: 'success', text: `Published to ${formatPhoneDisplay(currentFlowPhone)}` });
                    } catch (err) {
                      setMsg({ type: 'error', text: err?.data?.error || 'Failed to publish' });
                    }
                  }}
                  className="rounded-btn bg-telnyx-green px-4 py-1.5 text-xs font-medium text-white hover:bg-telnyx-green/90"
                >
                  Publish Changes
                </button>
              );
            }
            // Not active → Publish (needs number)
            if (!flowActive) {
              return currentFlowPhone ? (
                <button
                  onClick={async () => {
                    try {
                      if (hasUnsavedChanges) {
                        await updateFlow({ id: currentFlowId, name: flowName, description: flowDescription, flowData: { nodes, edges } }).unwrap();
                      }
                      await publishFlow({ id: currentFlowId, phoneNumber: currentFlowPhone }).unwrap();
                      setFlowActive(true);
                      setFlowHasDraft(false);
                      setHasUnsavedChanges(false);
                      setFlowPublishedAt(new Date().toISOString());
                      refetchFlows();
                      setMsg({ type: 'success', text: `Published to ${formatPhoneDisplay(currentFlowPhone)}` });
                    } catch (err) {
                      setMsg({ type: 'error', text: err?.data?.error || 'Failed to publish' });
                    }
                  }}
                  className="rounded-btn bg-telnyx-green px-4 py-1.5 text-xs font-medium text-white hover:bg-telnyx-green/90"
                >
                  Publish to {formatPhoneDisplay(currentFlowPhone)}
                </button>
              ) : (
                <button
                  onClick={() => { setPublishTargetId(currentFlowId); setPublishNumber(''); setShowPublishModal(true); }}
                  className="rounded-btn bg-telnyx-green px-4 py-1.5 text-xs font-medium text-white hover:bg-telnyx-green/90"
                >
                  Publish
                </button>
              );
            }
            return null;
          })()}
        </div>
      </div>

      {/* Main editor */}
      <div className="flex flex-1 gap-3 min-h-0">
        {/* Left: Node Palette */}
        <div className="w-48 flex-shrink-0 overflow-y-auto rounded-card border border-gray-200 bg-white shadow-sm">
          <div className="bg-gray-950 px-3 py-2 rounded-t-card">
            <h2 className="text-xs font-semibold text-white">Nodes</h2>
          </div>
          <div className="p-2 space-y-1">
            {(() => {
              const SECTION_LABELS = {
                trigger: 'Trigger',
                action: 'Call Control',
                media: 'Media',
                routing: 'Routing & Gather',
                recording: 'Recording',
                streaming: 'Streaming',
                ai: 'AI',
                conference: 'Conference',
                end: 'End Call',
              };
              let lastCategory = '';
              return NODE_PALETTE.map((item) => {
                const showHeader = item.category !== lastCategory;
                lastCategory = item.category;
                return (
                  <div key={item.type}>
                    {showHeader && (
                      <div className="flex items-center gap-1.5 px-1 pt-2 pb-0.5">
                        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[item.category] }} />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                          {SECTION_LABELS[item.category] || item.category}
                        </span>
                      </div>
                    )}
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/reactflow', JSON.stringify({ type: item.type, defaults: item.defaults }));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className="flex items-center gap-2 rounded-btn px-2.5 py-1.5 text-[11px] font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
                      />
                      {item.label}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 rounded-card border border-gray-200 bg-white shadow-sm overflow-hidden" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={memoizedNodeTypes}
            fitView
            deleteKeyCode="Delete"
            className="bg-gray-50"
          >
            <Controls className="!rounded-lg !border !border-gray-200 !shadow-md" />
            <MiniMap nodeStrokeWidth={3} className="!rounded-lg !border !border-gray-200 !shadow-md" maskColor="rgba(0,0,0,0.08)" />
            <Background variant="dots" gap={20} size={1} color="#d1d5db" />
            <Panel position="top-left">
              <div className="rounded-btn bg-white/90 backdrop-blur px-3 py-1 text-[10px] text-gray-400 border border-gray-200 shadow">
                Drag nodes from the left. Connect outputs → inputs.
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Right: Properties */}
        <div className="w-56 flex-shrink-0 overflow-y-auto rounded-card border border-gray-200 bg-white shadow-sm">
          <div className="bg-gray-950 px-3 py-2 rounded-t-card">
            <h2 className="text-xs font-semibold text-white">Properties</h2>
          </div>
          {selectedNode ? (
            <div className="p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{selectedNode.type}</span>
                <button onClick={() => deleteNode(selectedNode.id)} className="text-[10px] text-red-400 hover:text-red-600 font-medium">Delete</button>
              </div>
              {Object.entries(selectedNode.data).map(([key, value]) => {
                // Enum dropdowns for known fields
                const ENUM_OPTIONS = {
                  record: ['', 'record-from-answer', 'record-from-ringing'],
                  recordFormat: ['mp3', 'wav'],
                  recordChannels: ['single', 'dual'],
                  recordTrack: ['both', 'inbound', 'outbound'],
                  recordTrim: ['', 'trim-silence'],
                  cause: ['CALL_REJECTED', 'USER_BUSY', 'NORMAL_CLEARING'],
                  payloadType: ['text', 'ssml'],
                  serviceLevel: ['basic', 'premium'],
                  targetLegs: ['self', 'opposite', 'both'],
                  parkAfterUnbridge: ['', 'self', 'opposite'],
                  muteDtmf: ['none', 'both', 'self', 'opposite'],
                  streamTrack: ['', 'inbound_track', 'outbound_track', 'both_tracks'],
                  streamType: ['decrypted', 'raw'],
                  direction: ['incoming', 'outgoing', 'both', 'inbound', 'outbound'],
                  transcriptionEngine: ['Telnyx', 'Google', 'Deepgram', 'Azure'],
                  transcriptionTracks: ['inbound', 'outbound', 'both'],
                  engine: ['Krisp', 'Denoiser', 'DeepFilterNet'],
                  beepEnabled: ['always', 'never', 'on_enter', 'on_exit'],
                  answeringMachineDetection: ['', 'detect', 'detect_beep', 'detect_words', 'greeting_end', 'premium'],
                  format: ['mp3', 'wav'],
                  channels: ['single', 'dual'],
                  recordingTrack: ['both', 'inbound', 'outbound'],
                  audioType: ['', 'mp3', 'wav'],
                };
                if (ENUM_OPTIONS[key]) {
                  return (
                    <div key={key}>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                      </label>
                      <select value={value} onChange={(e) => updateNodeData(selectedNode.id, key, e.target.value)}
                        className="w-full rounded-btn border border-gray-300 px-2 py-1 text-[11px] focus:border-telnyx-green focus:outline-none">
                        {ENUM_OPTIONS[key].map((opt) => (
                          <option key={opt} value={opt}>{opt || '(none)'}</option>
                        ))}
                      </select>
                    </div>
                  );
                }
                if (key === 'payload') {
                  return (
                    <div key={key}>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Text</label>
                      <textarea value={value} onChange={(e) => updateNodeData(selectedNode.id, key, e.target.value)} rows={3}
                        className="w-full resize-none rounded-btn border border-gray-300 px-2 py-1 text-[11px] text-gray-900 focus:border-telnyx-green focus:outline-none" />
                    </div>
                  );
                }
                if (key === 'voice') {
                  const providers = Object.keys(voicesData);
                  const selectedLang = selectedNode.data.language || 'en-US';
                  return (
                    <div key={key}>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Voice</label>
                      <select value={value} onChange={(e) => updateNodeData(selectedNode.id, key, e.target.value)}
                        className="w-full rounded-btn border border-gray-300 px-2 py-1 text-[11px] focus:border-telnyx-green focus:outline-none">
                        <option value="female">Default Female</option>
                        <option value="male">Default Male</option>
                        {providers.flatMap((provider) => {
                          const filtered = (voicesData[provider] || []).filter((v) =>
                            v.language && (v.language === selectedLang || v.language.startsWith(selectedLang.split('-')[0]))
                          );
                          if (filtered.length === 0) return [];
                          // Group Telnyx voices by kind (e.g. Natural, NaturalHD, Ultra)
                          if (provider.toLowerCase() === 'telnyx') {
                            const byKind = {};
                            filtered.forEach((v) => {
                              const parts = (v.id || '').split('.');
                              const kind = parts.length >= 3 ? parts[1] : 'Other';
                              if (!byKind[kind]) byKind[kind] = [];
                              byKind[kind].push(v);
                            });
                            return Object.entries(byKind).map(([kind, voices]) => (
                              <optgroup key={`telnyx-${kind}`} label={`Telnyx ${kind}`}>
                                {voices.map((v, idx) => (
                                  <option key={`telnyx-${kind}-${v.id}-${idx}`} value={v.id}>
                                    {v.name} ({v.gender || '?'}) — {v.language}
                                  </option>
                                ))}
                              </optgroup>
                            ));
                          }
                          return [(
                            <optgroup key={provider} label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                              {filtered.map((v, idx) => (
                                <option key={`${provider}-${v.id}-${idx}`} value={v.id}>
                                  {v.name} ({v.gender || '?'}) — {v.language}
                                </option>
                              ))}
                            </optgroup>
                          )];
                        })}
                      </select>
                    </div>
                  );
                }
                if (key === 'language') {
                  return (
                    <div key={key}>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Language</label>
                      <select value={value} onChange={(e) => updateNodeData(selectedNode.id, key, e.target.value)}
                        className="w-full rounded-btn border border-gray-300 px-2 py-1 text-[11px] focus:border-telnyx-green focus:outline-none">
                        <option value="en-US">English (US)</option><option value="en-GB">English (UK)</option>
                        <option value="es-ES">Spanish</option><option value="fr-FR">French</option>
                        <option value="de-DE">German</option><option value="pt-BR">Portuguese</option>
                      </select>
                    </div>
                  );
                }
                // Audio URL fields — toggle between file picker and manual URL
                const AUDIO_URL_FIELDS = ['audioUrl', 'holdMusicUrl', 'invalidAudioUrl'];
                if (AUDIO_URL_FIELDS.includes(key)) {
                  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
                  const isFile = audioFiles.some((f) => f.url === value);
                  const modeKey = `${selectedNode.id}_${key}`;
                  const forceUrl = urlModeFields[modeKey];
                  const showFile = audioFiles.length > 0 && !forceUrl && (isFile || !value);
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] font-medium text-gray-500">{label}</label>
                        {audioFiles.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setUrlModeFields((prev) => ({ ...prev, [modeKey]: !showFile ? false : true }));
                              if (showFile) updateNodeData(selectedNode.id, key, '');
                            }}
                            className="text-[9px] text-telnyx-green hover:underline"
                          >
                            {showFile ? 'Use URL' : 'Use File'}
                          </button>
                        )}
                      </div>
                      {showFile ? (
                        <select
                          value={value}
                          onChange={(e) => updateNodeData(selectedNode.id, key, e.target.value)}
                          className="w-full rounded-btn border border-gray-300 px-2 py-1 text-[11px] focus:border-telnyx-green focus:outline-none"
                        >
                          <option value="">(none)</option>
                          {audioFiles.map((f) => (
                            <option key={f.fileName} value={f.url}>{f.originalName}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={value}
                          placeholder="https://example.com/audio.mp3"
                          onChange={(e) => updateNodeData(selectedNode.id, key, e.target.value)}
                          className="w-full rounded-btn border border-gray-300 px-2 py-1 text-[11px] text-gray-900 focus:border-telnyx-green focus:outline-none"
                        />
                      )}
                    </div>
                  );
                }
                if (typeof value === 'boolean') {
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <input type="checkbox" checked={value} onChange={(e) => updateNodeData(selectedNode.id, key, e.target.checked)}
                        className="rounded border-gray-300 text-telnyx-green focus:ring-telnyx-green" />
                      <label className="text-[10px] text-gray-600">{key}</label>
                    </div>
                  );
                }
                return (
                  <div key={key}>
                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                    </label>
                    <input type={typeof value === 'number' ? 'number' : 'text'} value={value}
                      onChange={(e) => updateNodeData(selectedNode.id, key, typeof value === 'number' ? Number(e.target.value) : e.target.value)}
                      className="w-full rounded-btn border border-gray-300 px-2 py-1 text-[11px] text-gray-900 focus:border-telnyx-green focus:outline-none" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <p className="text-[10px] text-gray-400">Click a node to edit</p>
            </div>
          )}
        </div>
      </div>

      {/* Publish Modal (shared) */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Publish Flow</h3>
            <p className="text-xs text-gray-500 mb-3">
              Assign this IVR flow to a phone number. When that number receives a call, this flow will execute instead of the default queue behavior.
            </p>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number</label>
            {numbersLoading ? (
              <div className="flex items-center gap-2 mb-4 text-xs text-gray-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-telnyx-green border-t-transparent" />
                Loading numbers...
              </div>
            ) : connectionNumbers.length === 0 ? (
              <p className="text-xs text-red-400 mb-4">No phone numbers assigned to the voice connection.</p>
            ) : (
              <select
                value={publishNumber}
                onChange={(e) => setPublishNumber(e.target.value)}
                className="w-full rounded-btn border border-gray-300 px-3 py-2 text-sm font-mono focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green mb-4"
              >
                <option value="">Select a number...</option>
                {connectionNumbers.map((n) => (
                  <option key={n.id} value={n.phone_number}>
                    {formatPhoneDisplay(n.phone_number)}
                  </option>
                ))}
              </select>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowPublishModal(false); setPublishTargetId(null); }}
                className="rounded-btn border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handlePublish} disabled={!publishNumber}
                className="rounded-btn bg-telnyx-green px-4 py-2 text-sm font-medium text-white hover:bg-telnyx-green/90 disabled:opacity-50">
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
