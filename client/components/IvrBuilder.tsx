'use client';

import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Save, Undo2, Redo2, ChevronDown, GripVertical,
  ZoomIn, ZoomOut, Maximize2, ShieldCheck, AlertTriangle, CheckCircle2,
  Sparkles, MousePointerClick, Plug, Play, X,
} from 'lucide-react';

import IvrNodeComponent from './ivr/IvrNodeComponent';
import PillEdge from './ivr/PillEdge';
import PropPanel from './ivr/PropPanel';
import { NODE_DEFS, getDefaultData, TEMPLATES, nodeInvalidReason } from './ivr/constants';

/* ═══════════════════════════════════════════════════════════════════════════
   Undo / Redo hook
   ═══════════════════════════════════════════════════════════════════════════ */

function useHistory(initialNodes: any[], initialEdges: any[]) {
  const [past, setPast] = useState<any[]>([]);
  const [future, setFuture] = useState<any[]>([]);
  const snapshotRef = useRef<{ nodes: any[]; edges: any[] }>({ nodes: initialNodes, edges: initialEdges });

  const pushSnapshot = useCallback((nodes: any[], edges: any[]): void => {
    setPast((p) => [...p.slice(-30), snapshotRef.current]);
    setFuture([]);
    snapshotRef.current = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return null;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [...f, snapshotRef.current]);
    snapshotRef.current = prev;
    return prev;
  }, [past]);

  const redo = useCallback(() => {
    if (future.length === 0) return null;
    const next = future[future.length - 1];
    setFuture((f) => f.slice(0, -1));
    setPast((p) => [...p, snapshotRef.current]);
    snapshotRef.current = next;
    return next;
  }, [future]);

  return { pushSnapshot, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

const nodeTypes: any = { ivrNode: IvrNodeComponent };
const edgeTypes: any = { pill: PillEdge };

function markEntryNode(nodes: any[]): any[] {
  const entryId = nodes.find((n) => n.data?.type === 'answer')?.id || nodes[0]?.id;
  return nodes.map((n) => ({
    ...n,
    data: { ...n.data, _isEntry: n.id === entryId },
  }));
}

function prepNodes(raw: any[]): any[] {
  return markEntryNode(
    raw.map((n) => ({
      ...n,
      type: 'ivrNode',
      data: { ...n.data, type: n.data?.type || n.type },
    }))
  );
}

function prepEdges(raw: any[]): any[] {
  return raw.map((e) => ({
    ...e,
    type: 'pill',
    data: { sourceHandle: e.sourceHandle },
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: e.sourceHandle && e.sourceHandle !== 'default' ? '#f59e0b' : '#10b981' },
  }));
}

/* ─── Sidebar groups (logical + color-coded) ──────────────────────────────── */
const SIDEBAR_GROUPS: { title: string; subtitle: string; types: string[] }[] = [
  { title: 'Start / Greeting',  subtitle: 'Pick up & greet the caller',          types: ['answer', 'speak', 'callback'] },
  { title: 'Collect Input',     subtitle: 'Listen for keypad / machine',         types: ['gather', 'amd'] },
  { title: 'Transfer / Route',  subtitle: 'Send caller to a destination',        types: ['enqueue', 'transfer', 'voicemail'] },
  { title: 'Branch / Whisper',  subtitle: 'Agent-side & conditional messages',   types: ['whisper'] },
  { title: 'Media',             subtitle: 'Record or play audio',                types: ['record', 'play'] },
  { title: 'End',               subtitle: 'Hang up the call',                    types: ['hangup'] },
];

/* ─── Empty canvas hint ────────────────────────────────────────────────────── */
function EmptyCanvasHint({ onLoadTemplate }: { onLoadTemplate: (tpl: any) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]"
    >
      <div className="pointer-events-auto max-w-md mx-6 bg-tx-s1/90 backdrop-blur-xl border border-tx-bdefault/60 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-tx-tp">How to build a flow</h3>
            <p className="text-[11px] text-tx-tt">Three quick steps to get started</p>
          </div>
        </div>

        <ol className="space-y-3 mb-5">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold flex items-center justify-center flex-shrink-0">1</span>
            <div>
              <p className="text-xs font-medium text-tx-tp flex items-center gap-1.5">
                <MousePointerClick className="w-3 h-3 text-tx-ts" /> Drag a node from the left
              </p>
              <p className="text-[11px] text-tx-tt mt-0.5">Start with <span className="text-emerald-400 font-medium">Answer</span>, then add a <span className="text-emerald-400 font-medium">Play Audio</span> greeting.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-[11px] font-bold flex items-center justify-center flex-shrink-0">2</span>
            <div>
              <p className="text-xs font-medium text-tx-tp flex items-center gap-1.5">
                <Plug className="w-3 h-3 text-tx-ts" /> Connect outputs to inputs
              </p>
              <p className="text-[11px] text-tx-tt mt-0.5">Drag from the pulsing dot at the bottom of a node to the top of the next one.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] font-bold flex items-center justify-center flex-shrink-0">3</span>
            <div>
              <p className="text-xs font-medium text-tx-tp flex items-center gap-1.5">
                <Play className="w-3 h-3 text-tx-ts" /> Validate, save & test
              </p>
              <p className="text-[11px] text-tx-tt mt-0.5">Click <span className="text-tx-tp font-medium">Validate</span> to highlight issues, then <span className="text-tx-tp font-medium">Test Flow</span>.</p>
            </div>
          </li>
        </ol>

        <div>
          <p className="text-[10px] font-bold text-tx-ts uppercase tracking-widest mb-2">Or start from a template</p>
          <div className="grid grid-cols-1 gap-1.5">
            {TEMPLATES.map((tpl) => {
              const TplIcon = tpl.icon;
              return (
                <button
                  key={tpl.name}
                  onClick={() => onLoadTemplate(tpl)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition text-left"
                >
                  <TplIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-tx-tp">{tpl.name}</span>
                  <span className="text-[10px] text-tx-tt ml-auto">{tpl.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Inner builder
   ═══════════════════════════════════════════════════════════════════════════ */

function InnerBuilder({ initialNodes, initialEdges, onSave, activeSimNodeId }: { initialNodes: any[]; initialEdges: any[]; onSave?: (nodes: any[], edges: any[]) => void; activeSimNodeId?: string | null }) {
  const rfInstance = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    prepNodes(initialNodes.map((n) => ({ ...n, type: 'ivrNode', data: { ...n.data, type: n.data?.type || n.type } })))
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(prepEdges(initialEdges));
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [dragType, setDragType] = useState<string | null>(null);
  const [validationActive, setValidationActive] = useState(false);
  const [validationToast, setValidationToast] = useState<{ kind: 'ok' | 'warn'; msg: string; issues?: string[] } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const nodesWithFlags = useMemo(() =>
    nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        _simActive: n.id === activeSimNodeId,
        _validationActive: validationActive,
      },
    })),
    [nodes, activeSimNodeId, validationActive],
  );

  const { pushSnapshot, undo, redo, canUndo, canRedo } = useHistory(nodes, edges);

  /* ── Connect ── */
  const onConnect = useCallback((params) => {
    pushSnapshot(nodes, edges);
    setEdges((eds) =>
      addEdge({
        ...params,
        type: 'pill',
        data: { sourceHandle: params.sourceHandle },
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: params.sourceHandle && params.sourceHandle !== 'default' ? '#f59e0b' : '#10b981' },
      }, eds)
    );
  }, [setEdges, pushSnapshot, nodes, edges]);

  /* ── Select ── */
  const onNodeClick = useCallback((_, node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  /* ── Add ── */
  const addNode = useCallback((type) => {
    pushSnapshot(nodes, edges);
    const id = `node-${Date.now()}`;
    const data = { ...getDefaultData(type), type };
    const position = { x: 200 + Math.random() * 200, y: 80 + nodes.length * 120 };
    setNodes((nds) => markEntryNode([...nds, { id, type: 'ivrNode', data, position }]));
  }, [nodes, edges, setNodes, pushSnapshot]);

  /* ── Drag ── */
  const onDragStart = useCallback((e, type) => {
    setDragType(type);
    e.dataTransfer.effectAllowed = 'move';
  }, []);
  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    if (!dragType) return;
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const position = rfInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    pushSnapshot(nodes, edges);
    const id = `node-${Date.now()}`;
    const data = { ...getDefaultData(dragType), type: dragType };
    setNodes((nds) => markEntryNode([...nds, { id, type: 'ivrNode', data, position }]));
    setDragType(null);
  }, [dragType, rfInstance, pushSnapshot, nodes, edges, setNodes]);

  /* ── Update ── */
  const updateNodeData = useCallback((field, value) => {
    if (!selectedNode) return;
    pushSnapshot(nodes, edges);
    setNodes((nds) =>
      markEntryNode(nds.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, [field]: value } } : n))
    );
    setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, [field]: value } } : null);
    if (validationActive) { setValidationActive(false); setValidationToast(null); }
  }, [selectedNode, setNodes, pushSnapshot, nodes, edges, validationActive]);

  /* ── Delete ── */
  const deleteNode = useCallback(() => {
    if (!selectedNode) return;
    pushSnapshot(nodes, edges);
    setNodes((nds) => markEntryNode(nds.filter((n) => n.id !== selectedNode.id)));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  }, [selectedNode, setNodes, setEdges, pushSnapshot, nodes, edges]);

  /* ── Undo / Redo ── */
  const handleUndo = useCallback(() => {
    const s = undo();
    if (s) { setNodes(markEntryNode(s.nodes)); setEdges(prepEdges(s.edges)); setSelectedNode(null); }
  }, [undo, setNodes, setEdges]);
  const handleRedo = useCallback(() => {
    const s = redo();
    if (s) { setNodes(markEntryNode(s.nodes)); setEdges(prepEdges(s.edges)); setSelectedNode(null); }
  }, [redo, setNodes, setEdges]);

  /* ── Templates ── */
  const loadTemplate = useCallback((tpl) => {
    pushSnapshot(nodes, edges);
    const tplNodes = tpl.nodes.map((n) => ({
      ...n,
      type: 'ivrNode',
      data: { ...n.data, type: n.type },
    }));
    setNodes(markEntryNode(tplNodes));
    setEdges(prepEdges(tpl.edges));
    setSelectedNode(null);
    setTimeout(() => rfInstance.fitView({ padding: 0.2 }), 50);
  }, [pushSnapshot, nodes, edges, setNodes, setEdges, rfInstance]);

  /* ── Save ── */
  const handleSave = useCallback(() => {
    const flowNodes = nodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      data: Object.fromEntries(Object.entries(n.data).filter(([k]) => !['type', '_isEntry', '_simActive', '_validationActive'].includes(k))),
      position: n.position,
    }));
    const flowEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      label: e.label,
    }));
    onSave?.(flowNodes, flowEdges);
  }, [nodes, edges, onSave]);

  /* ── Validate ── */
  const handleValidate = useCallback(() => {
    const issues: string[] = [];

    if (nodes.length === 0) {
      issues.push('Flow is empty — drag in an Answer node to begin.');
    } else {
      const hasAnswer = nodes.some((n) => n.data?.type === 'answer');
      if (!hasAnswer) issues.push('No Answer node — every flow should start with Answer.');

      for (const n of nodes) {
        const reason = nodeInvalidReason(n.data);
        if (reason) issues.push(`${NODE_DEFS[n.data.type]?.label || n.data.type}: ${reason}`);
      }

      const terminalTypes = new Set(['hangup', 'enqueue', 'transfer', 'voicemail']);
      const outgoing = new Set(edges.map((e) => e.source));
      for (const n of nodes) {
        if (terminalTypes.has(n.data.type)) continue;
        if (!outgoing.has(n.id)) {
          issues.push(`${NODE_DEFS[n.data.type]?.label || n.data.type} has no outgoing connection.`);
        }
      }
    }

    setValidationActive(true);
    if (issues.length === 0) {
      setValidationToast({ kind: 'ok', msg: 'Flow looks good — ready to publish.' });
      setTimeout(() => setValidationToast(null), 4500);
    } else {
      setValidationToast({ kind: 'warn', msg: `${issues.length} issue${issues.length === 1 ? '' : 's'} found`, issues });
    }
  }, [nodes, edges]);

  /* ── Keyboard ── */
  const onKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? handleRedo() : handleUndo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
    if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedNode && document.activeElement === document.body) deleteNode(); }
  }, [handleUndo, handleRedo, selectedNode, deleteNode]);

  const toggleGroup = useCallback((title: string) => {
    setCollapsedGroups((g) => ({ ...g, [title]: !g[title] }));
  }, []);

  const flowIsEmpty = nodes.length === 0;

  return (
    <div className="flex h-full" onKeyDown={onKeyDown} tabIndex={0}>
      {/* Inline animations */}
      <style jsx global>{`
        @keyframes ivrPulseRing {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(1.9); opacity: 0;   }
          100% { transform: scale(1.9); opacity: 0;   }
        }
        .ivr-pulse-ring { animation: ivrPulseRing 1.8s ease-out infinite; }
        @keyframes ivrShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-3px); }
          40% { transform: translateX(3px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        .ivr-shake { animation: ivrShake 0.5s ease-in-out 1; }
      `}</style>

      {/* ─── Sidebar ─── */}
      <div className="w-64 bg-tx-s1/85 backdrop-blur-xl border-r border-tx-bdefault/50 overflow-y-auto flex-shrink-0 flex flex-col">
        <div className="px-4 py-3 border-b border-tx-bdefault/40">
          <h2 className="text-sm font-semibold text-tx-tp">Node Library</h2>
          <p className="text-[11px] text-tx-tt mt-0.5">Drag onto the canvas or click to add</p>
        </div>

        <div className="p-3 space-y-4 flex-1">
          {SIDEBAR_GROUPS.map((group) => {
            const collapsed = !!collapsedGroups[group.title];
            return (
              <div key={group.title}>
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-start justify-between mb-1.5"
                >
                  <div className="text-left">
                    <h3 className="text-[10.5px] font-bold text-tx-ts uppercase tracking-widest">{group.title}</h3>
                    <p className="text-[10px] text-tx-tt mt-0.5">{group.subtitle}</p>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-tx-tt mt-0.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
                </button>

                {!collapsed && (
                  <div className="space-y-1.5">
                    {group.types.map((type) => {
                      const def = NODE_DEFS[type];
                      if (!def) return null;
                      const Icon = def.icon;
                      return (
                        <div
                          key={type}
                          draggable
                          onDragStart={(e) => onDragStart(e, type)}
                          onClick={() => addNode(type)}
                          title={def.longDesc}
                          className="w-full text-left px-2.5 py-2 rounded-xl bg-tx-s2 border border-tx-bdefault/30 hover:bg-tx-s3 hover:border-tx-bdefault transition flex items-start gap-2.5 cursor-grab active:cursor-grabbing group"
                        >
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${def.bg} flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`font-semibold text-[12px] ${def.accent}`}>{def.label}</span>
                            <p className="text-[10px] text-tx-tt leading-snug mt-0.5">{def.longDesc}</p>
                          </div>
                          <GripVertical className="w-3.5 h-3.5 text-tx-tt opacity-40 group-hover:opacity-80 transition flex-shrink-0 mt-0.5" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Templates */}
          <div>
            <h3 className="text-[10.5px] font-bold text-tx-ts uppercase tracking-widest mb-2">Templates</h3>
            <div className="space-y-1.5">
              {TEMPLATES.map((tpl) => {
                const TplIcon = tpl.icon;
                return (
                  <button
                    key={tpl.name}
                    onClick={() => loadTemplate(tpl)}
                    className="w-full text-left px-2.5 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15 hover:bg-emerald-500/10 hover:border-emerald-500/25 transition flex items-center gap-2.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <TplIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-emerald-400 text-xs">{tpl.name}</span>
                      <p className="text-[10px] text-tx-tt">{tpl.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom: Save */}
        <div className="border-t border-tx-bdefault/50 p-3 space-y-2">
          <button
            onClick={handleSave}
            className="w-full py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Flow
          </button>
        </div>
      </div>

      {/* ─── Canvas ─── */}
      <div className="flex-1 bg-tx-s1 relative" ref={wrapperRef} onDrop={onDrop} onDragOver={onDragOver}>
        {/* Floating toolbar */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-tx-s3/80 backdrop-blur-sm rounded-xl border border-tx-bdefault/50 p-1 shadow-lg">
          <button onClick={handleUndo} disabled={!canUndo} title="Undo (⌘Z)"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-tx-ts hover:bg-tx-s3 hover:text-tx-tp transition disabled:opacity-30 disabled:hover:bg-transparent">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={handleRedo} disabled={!canRedo} title="Redo (⌘⇧Z)"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-tx-ts hover:bg-tx-s3 hover:text-tx-tp transition disabled:opacity-30 disabled:hover:bg-transparent">
            <Redo2 className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-tx-bdefault/40 mx-0.5" />
          <button onClick={() => rfInstance.zoomOut()} title="Zoom out"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-tx-ts hover:bg-tx-s3 hover:text-tx-tp transition">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={() => rfInstance.zoomIn()} title="Zoom in"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-tx-ts hover:bg-tx-s3 hover:text-tx-tp transition">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => rfInstance.fitView({ padding: 0.2 })} title="Fit to view"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-tx-ts hover:bg-tx-s3 hover:text-tx-tp transition">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Validate button (top-right) */}
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={handleValidate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-tx-s3/85 backdrop-blur-sm border border-tx-bdefault/50 text-tx-tp text-xs font-semibold shadow-lg hover:bg-tx-s3 transition"
            title="Validate the flow — highlights misconfigured nodes"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Validate
          </button>
        </div>

        {/* Validation toast */}
        <AnimatePresence>
          {validationToast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-16 right-3 z-20 max-w-sm"
            >
              <div className={`rounded-xl border p-3 shadow-2xl backdrop-blur-xl ${
                validationToast.kind === 'ok'
                  ? 'bg-emerald-500/15 border-emerald-500/30'
                  : 'bg-rose-500/15 border-rose-500/30'
              }`}>
                <div className="flex items-start gap-2">
                  {validationToast.kind === 'ok'
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    : <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${validationToast.kind === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {validationToast.msg}
                    </p>
                    {validationToast.issues && validationToast.issues.length > 0 && (
                      <ul className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
                        {validationToast.issues.slice(0, 6).map((iss, idx) => (
                          <li key={idx} className="text-[11px] text-tx-tp/90 leading-snug flex gap-1.5">
                            <span className="text-rose-400 flex-shrink-0">•</span>
                            <span>{iss}</span>
                          </li>
                        ))}
                        {validationToast.issues.length > 6 && (
                          <li className="text-[10px] text-tx-tt italic">…and {validationToast.issues.length - 6} more.</li>
                        )}
                      </ul>
                    )}
                  </div>
                  <button onClick={() => setValidationToast(null)} className="text-tx-ts hover:text-tx-tp transition flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty-canvas getting-started overlay */}
        {flowIsEmpty && <EmptyCanvasHint onLoadTemplate={loadTemplate} />}

        <ReactFlow
          nodes={nodesWithFlags}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: 'pill', animated: true }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          snapToGrid
          snapGrid={[16, 16]}
        >
          <MiniMap
            nodeStrokeColor={(n) => NODE_DEFS[n.data?.type]?.border || 'var(--text-tertiary)'}
            nodeColor={(n) => NODE_DEFS[n.data?.type]?.border || 'var(--surface-3)'}
            nodeBorderRadius={12}
            className="shadow-lg rounded-xl border-0 ivr-minimap"
            position="bottom-right"
          />
          <Background variant={"dots" as any} gap={16} size={1} color="var(--ivr-dot-color, rgba(99,102,241,0.18))" />
        </ReactFlow>
      </div>

      {/* ─── Property panel ─── */}
      <AnimatePresence>
        {selectedNode && (
          <PropPanel
            key={selectedNode.id}
            node={selectedNode}
            onUpdate={updateNodeData}
            onDelete={deleteNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Exported wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

export default function IvrBuilder(props: { ivrId?: string; initialFlow?: any; initialNodes?: any[]; initialEdges?: any[]; onSave?: (nodes: any[], edges: any[]) => void; activeSimNodeId?: string | null }) {
  const { initialFlow, onSave, activeSimNodeId } = props;
  const initialNodes = props.initialNodes || initialFlow?.nodes || [];
  const initialEdges = props.initialEdges || initialFlow?.edges || [];
  return (
    <ReactFlowProvider>
      <InnerBuilder initialNodes={initialNodes} initialEdges={initialEdges} onSave={onSave} activeSimNodeId={activeSimNodeId} />
    </ReactFlowProvider>
  );
}
