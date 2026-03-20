'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
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
import { nodeTypes, NODE_PALETTE, DEFAULT_FLOW } from './nodeTypes';
import {
  useGetIvrFlowsQuery,
  useGetIvrFlowQuery,
  useCreateIvrFlowMutation,
  useUpdateIvrFlowMutation,
  useDeleteIvrFlowMutation,
  usePublishIvrFlowMutation,
  useUnpublishIvrFlowMutation,
  useGetConnectionNumbersQuery,
} from '../../../src/store/api';
import { formatPhoneDisplay } from '../../../src/lib/phone-utils';

const CATEGORY_COLORS = {
  trigger: '#00a37a',
  action: '#2563eb',
  media: '#9333ea',
  routing: '#d97706',
  conference: '#db2777',
  end: '#dc2626',
};

let idCounter = 100;
function getId() { return `node_${idCounter++}`; }

export default function IVRBuilderPage() {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(DEFAULT_FLOW.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(DEFAULT_FLOW.edges);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // Flow management state
  const [currentFlowId, setCurrentFlowId] = useState(null);
  const [flowName, setFlowName] = useState('Untitled Flow');
  const [flowDescription, setFlowDescription] = useState('');
  const [publishNumber, setPublishNumber] = useState('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishTargetId, setPublishTargetId] = useState(null); // for list quick-publish
  const [showFlowList, setShowFlowList] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // API hooks
  const { data: flows = [], isLoading: flowsLoading } = useGetIvrFlowsQuery();
  const [createFlow, { isLoading: creating }] = useCreateIvrFlowMutation();
  const [updateFlow, { isLoading: updating }] = useUpdateIvrFlowMutation();
  const [deleteFlow] = useDeleteIvrFlowMutation();
  const [publishFlow] = usePublishIvrFlowMutation();
  const [unpublishFlow] = useUnpublishIvrFlowMutation();
  const { data: connectionNumbers = [], isLoading: numbersLoading } = useGetConnectionNumbersQuery();

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#666' } }, eds)),
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
      const { type, defaults } = JSON.parse(raw);
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setNodes((nds) => nds.concat({ id: getId(), type, position, data: { ...defaults } }));
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
        setMsg({ type: 'success', text: 'Flow saved' });
      } else {
        const result = await createFlow({ name: flowName, description: flowDescription, flowData }).unwrap();
        setCurrentFlowId(result.id);
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
    // Fetch full flow data
    try {
      const res = await fetch(
        `https://${process.env.NEXT_PUBLIC_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT}/api/ivr/${flow.id}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      const full = await res.json();
      if (full.flowData?.nodes) {
        setNodes(full.flowData.nodes);
        setEdges(full.flowData.edges || []);
      }
    } catch { /* noop */ }
    setShowFlowList(false);
    setMsg({ type: '', text: '' });
  };

  // ── New flow ──
  const handleNewFlow = () => {
    setCurrentFlowId(null);
    setFlowName('Untitled Flow');
    setFlowDescription('');
    setNodes(DEFAULT_FLOW.nodes);
    setEdges(DEFAULT_FLOW.edges);
    setShowFlowList(false);
    setSelectedNode(null);
    setMsg({ type: '', text: '' });
  };

  // ── Delete flow ──
  const handleDelete = async (id) => {
    if (!confirm('Delete this flow?')) return;
    try {
      await deleteFlow(id).unwrap();
      if (currentFlowId === id) handleNewFlow();
    } catch { /* noop */ }
  };

  // ── Publish ──
  const handlePublish = async () => {
    const targetId = publishTargetId || currentFlowId;
    if (!publishNumber || !targetId) return;
    try {
      await publishFlow({ id: targetId, phoneNumber: publishNumber }).unwrap();
      setShowPublishModal(false);
      setPublishTargetId(null);
      setPublishNumber('');
      setMsg({ type: 'success', text: `Published to ${publishNumber}` });
    } catch (err) {
      setMsg({ type: 'error', text: err?.data?.error || 'Failed to publish' });
    }
  };

  // ── Unpublish ──
  const handleUnpublish = async (id) => {
    try {
      await unpublishFlow(id).unwrap();
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
                  <div className="flex items-center justify-between rounded-t-[14px] bg-telnyx-green px-4 py-2">
                    <div className="flex items-center gap-2 text-white">
                      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider">Active</span>
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
                    {!flow.active && (
                      <p className="mt-1 text-[10px] text-gray-300">
                        {flow.phoneNumber
                          ? `Last assigned to ${formatPhoneDisplay(flow.phoneNumber)} (inactive)`
                          : 'Not assigned to any number'}
                      </p>
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
            onClick={() => setShowFlowList(true)}
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
          {msg.text && (
            <span className={`text-xs ${msg.type === 'error' ? 'text-red-500' : 'text-telnyx-green'}`}>
              {msg.text}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={creating || updating}
            className="rounded-btn bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {creating || updating ? 'Saving...' : 'Save'}
          </button>
          {currentFlowId && (
            <button
              onClick={() => { setPublishTargetId(currentFlowId); setShowPublishModal(true); }}
              className="rounded-btn bg-telnyx-green px-4 py-1.5 text-xs font-medium text-white hover:bg-telnyx-green/90"
            >
              Publish
            </button>
          )}
        </div>
      </div>

      {/* Main editor */}
      <div className="flex flex-1 gap-3 min-h-0">
        {/* Left: Node Palette */}
        <div className="w-48 flex-shrink-0 overflow-y-auto rounded-card border border-gray-200 bg-white shadow-sm">
          <div className="bg-gray-950 px-3 py-2 rounded-t-card">
            <h2 className="text-xs font-semibold text-white">Nodes</h2>
          </div>
          <div className="p-2 space-y-0.5">
            {NODE_PALETTE.map((item) => (
              <div
                key={item.type}
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
            ))}
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
                  return (
                    <div key={key}>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Voice</label>
                      <select value={value} onChange={(e) => updateNodeData(selectedNode.id, key, e.target.value)}
                        className="w-full rounded-btn border border-gray-300 px-2 py-1 text-[11px] focus:border-telnyx-green focus:outline-none">
                        <option value="female">Female</option><option value="male">Male</option>
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
