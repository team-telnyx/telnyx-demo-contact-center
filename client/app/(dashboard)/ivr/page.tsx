'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import api from '../../../lib/api';
import ErrorBoundary from '../../../components/ErrorBoundary';
import TelnyxApiInfo from '../../../components/TelnyxApiInfo';
import {
  GitBranch,
  Plus,
  Trash2,
  Send,
  Globe,
  FileEdit,
  Loader2,
  Save,
  Play,
  ArrowLeft,
  Clock,
  MoreVertical,
  Copy,
  RotateCcw,
  X,
  Phone,
  PhoneCall,
  Mic,
  Volume2,
  Users,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';

const IvrBuilder = dynamic(
  () => import('../../../components/IvrBuilder'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96 bg-tx-s2 border border-tx-bsubtle rounded-xl">
        <div className="flex items-center gap-2 text-tx-ts">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading IVR builder...
        </div>
      </div>
    ),
  }
) as React.ComponentType<{ ivrId?: string; initialFlow?: any; initialNodes?: any[]; initialEdges?: any[]; onSave?: (nodes: any[], edges: any[]) => void; activeSimNodeId?: string | null; key?: any }>;

const DTMF_KEYS = [
  { digit: '1', sub: '' }, { digit: '2', sub: 'ABC' }, { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' }, { digit: '5', sub: 'JKL' }, { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' }, { digit: '8', sub: 'TUV' }, { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: '' }, { digit: '0', sub: '+' }, { digit: '#', sub: '' },
];

function IvrSimulator({ flow, onClose, onActiveNodeChange }) {
  const [simSteps, setSimSteps] = useState<any[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [simPhase, setSimPhase] = useState('idle');
  const [gatherDigits, setGatherDigits] = useState<any[]>([]);
  const [allDigits, setAllDigits] = useState<any[]>([]);
  const [typedText, setTypedText] = useState('');
  const [typingIdx, setTypingIdx] = useState(-1);
  const currentStep = simSteps[currentStepIdx];
  const timerRef = useRef(null);
  const typeTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      clearInterval(typeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (onActiveNodeChange && currentStepIdx >= 0 && simSteps[currentStepIdx]) {
      onActiveNodeChange(simSteps[currentStepIdx].nodeId);
    }
  }, [currentStepIdx, simSteps, onActiveNodeChange]);

  const animateTyping = useCallback((text, onComplete) => {
    let charIdx = 0;
    setTypedText('');
    typeTimerRef.current = setInterval(() => {
      charIdx++;
      setTypedText(text.slice(0, charIdx));
      if (charIdx >= text.length) {
        clearInterval(typeTimerRef.current);
        setTimeout(onComplete, 300);
      }
    }, 35);
  }, []);

  const advanceStep = useCallback((steps, startIdx) => {
    let idx = startIdx;
    const processStep = () => {
      if (idx >= steps.length) { setSimPhase('complete'); return; }
      const step = steps[idx];
      setCurrentStepIdx(idx);
      if (step.action === 'gather' && step.gatherResult === null) {
        setSimPhase('waiting-gather');
        return;
      }
      if (step.nodeType === 'speak' && step.spokenText) {
        setTypingIdx(idx);
        animateTyping(step.spokenText, () => {
          idx++;
          timerRef.current = setTimeout(processStep, 800);
        });
      } else {
        idx++;
        timerRef.current = setTimeout(processStep, 1000);
      }
    };
    processStep();
  }, [animateTyping]);

  const startSimulation = useCallback(async (digits) => {
    setSimPhase('running');
    setSimSteps([]);
    setCurrentStepIdx(-1);
    setTypedText('');
    setTypingIdx(-1);
    setGatherDigits([]);
    try {
      const result = await api.post(`/ivr/${flow.id}/simulate`, { digits });
      const steps = result.path || result.steps || result || [];
      setSimSteps(steps);
      if (steps.length > 0) { advanceStep(steps, 0); } else { setSimPhase('complete'); }
    } catch (err: any) { console.error('Simulation failed', err); setSimPhase('idle'); }
  }, [flow.id, advanceStep]);

  const handleDtmfPress = useCallback((digit) => {
    setGatherDigits((prev) => [...prev, digit]);
    const newAllDigits = [...allDigits, digit];
    setAllDigits(newAllDigits);
    clearTimeout(timerRef.current);
    clearInterval(typeTimerRef.current);
    startSimulation(newAllDigits);
  }, [allDigits, startSimulation]);

  const handleRestart = useCallback(() => {
    clearTimeout(timerRef.current);
    clearInterval(typeTimerRef.current);
    setSimSteps([]);
    setCurrentStepIdx(-1);
    setSimPhase('idle');
    setGatherDigits([]);
    setAllDigits([]);
    setTypedText('');
    setTypingIdx(-1);
    if (onActiveNodeChange) onActiveNodeChange(null);
  }, [onActiveNodeChange]);

  useEffect(() => { startSimulation([]); }, []);

  return (
    <motion.div
      initial={{ x: 360, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 360, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="w-[340px] flex-shrink-0 border-l border-tx-bdefault bg-tx-s1/90 backdrop-blur-xl flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-tx-bdefault">
        <div className="flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-tx-green" />
          <span className="text-sm font-semibold text-tx-tp">Simulator</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleRestart} className="p-1.5 rounded-lg text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors" title="Restart"><RotateCcw className="w-3.5 h-3.5" /></button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors" title="Close"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        <div className="bg-tx-s0 rounded-3xl border border-tx-bdefault shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-tx-s2 px-5 py-2 flex items-center justify-between">
            <span className="text-[10px] text-tx-ts">Telnyx</span>
            <div className="w-16 h-4 rounded-full bg-tx-s3" />
            <div className="flex items-center gap-1"><div className="w-1 h-1.5 bg-tx-green rounded-full" /><span className="text-[10px] text-tx-ts">LTE</span></div>
          </div>
          <div className="bg-tx-s1/80 px-5 py-4 text-center border-b border-tx-bdefault">
            <div className="flex items-center justify-center gap-2 mb-1"><Phone className="w-3.5 h-3.5 text-tx-green" /><span className="text-xs font-semibold text-tx-tp">Simulating: {flow.name}</span></div>
            <span className="text-[10px] text-tx-tt">{simPhase === 'idle' ? 'Starting...' : simPhase === 'running' ? 'Call in progress' : simPhase === 'waiting-gather' ? 'Waiting for input...' : 'Call ended'}</span>
          </div>
          <div className="flex-1 min-h-[280px] px-4 py-3 space-y-2 overflow-y-auto bg-gradient-to-b from-tx-s1/40 to-tx-s0/80">
            <AnimatePresence mode="popLayout">
              {simSteps.slice(0, currentStepIdx + 1).map((step, idx) => {
                const isCurrent = idx === currentStepIdx;
                const showText = idx === typingIdx ? typedText : step.spokenText;
                return (
                  <motion.div
                    key={step.nodeId + '-' + idx}
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`rounded-xl px-3 py-2.5 ${
                      step.nodeType === 'enqueue' || step.nodeType === 'transfer'
                        ? 'bg-tx-citron/10 border border-tx-citron/20'
                        : step.action === 'hangup'
                          ? 'bg-tx-red/10 border border-tx-red/20'
                          : isCurrent
                            ? 'bg-tx-green/10 border border-tx-green/20'
                            : 'bg-tx-s3/60 border border-tx-bdefault'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {step.nodeType === 'speak' && <Volume2 className="w-3 h-3 text-tx-green" />}
                      {step.nodeType === 'gather' && <Mic className="w-3 h-3 text-tx-citron" />}
                      {step.nodeType === 'enqueue' && <Users className="w-3 h-3 text-tx-citron" />}
                      {step.nodeType === 'transfer' && <PhoneCall className="w-3 h-3 text-tx-citron" />}
                      {step.nodeType === 'answer' && <Phone className="w-3 h-3 text-tx-green" />}
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-tx-ts">{step.nodeType}</span>
                      {step.gatherResult && <span className="ml-auto text-[10px] font-mono bg-tx-citron/20 text-tx-citron px-1.5 py-0.5 rounded">Pressed: {step.gatherResult}</span>}
                    </div>
                    {showText && (
                      <p className="text-xs text-tx-tp/90 leading-relaxed">
                        {step.nodeType === 'speak' && isCurrent && idx === typingIdx
                          ? <>{showText}<span className="animate-pulse text-tx-green">|</span></>
                          : showText
                        }
                      </p>
                    )}
                    {step.nodeType === 'enqueue' && step.action === 'enqueue' && <p className="text-xs text-tx-citron font-medium">📞 Call queued to {(step.spokenText || '').replace('Enqueued to: ', '')}</p>}
                    {step.nodeType === 'transfer' && step.action === 'transfer' && <p className="text-xs text-tx-citron font-medium">🔄 Transferring to {(step.spokenText || '').replace('Transfer to: ', '')}</p>}
                    {step.action === 'hangup' && <p className="text-xs text-tx-red font-medium">📞 Call ended</p>}
                    {step.action === 'gather-timeout' && <p className="text-xs text-tx-citron/80 italic">⏰ No input received (timeout)</p>}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {simSteps.length === 0 && simPhase === 'running' && <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-tx-green" /></div>}
          </div>
          {(simPhase === 'waiting-gather' || (currentStep?.nodeType === 'gather' && simPhase === 'running')) && (
            <div className="border-t border-tx-bdefault p-3 bg-tx-s2/50">
              <p className="text-[10px] text-center text-tx-ts mb-2">{gatherDigits.length > 0 ? `Digits entered: ${gatherDigits.join('')}` : 'Press a key to continue the flow'}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {DTMF_KEYS.map(({ digit, sub }) => (
                  <motion.button key={digit} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => handleDtmfPress(digit)} className="bg-tx-s3 hover:bg-tx-s4 border border-tx-bdefault rounded-xl py-2.5 flex flex-col items-center justify-center transition-colors active:bg-tx-green/20 active:border-tx-green/30">
                    <span className="text-sm font-semibold text-tx-tp">{digit}</span>
                    {sub && <span className="text-[7px] text-tx-tt tracking-widest">{sub}</span>}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
          {simPhase === 'complete' && (
            <div className="border-t border-tx-bdefault p-3 bg-tx-s2/50">
              <p className="text-[10px] text-center text-tx-ts mb-2">Simulation complete</p>
              <button onClick={handleRestart} className="w-full py-2 rounded-xl bg-tx-green/15 border border-tx-green/25 text-tx-green text-xs font-semibold hover:bg-tx-green/20 transition-colors flex items-center justify-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Restart</button>
            </div>
          )}
        </div>
        {simSteps.length > 0 && (
          <div className="mt-3 px-1">
            <p className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider mb-1.5">Execution Path</p>
            <div className="flex flex-wrap gap-1">
              {simSteps.map((step, idx) => (
                <div key={step.nodeId + '-' + idx} className={`text-[9px] px-1.5 py-0.5 rounded-md border ${idx === currentStepIdx ? 'bg-tx-green/15 border-tx-green/30 text-tx-green font-bold' : idx < currentStepIdx ? 'bg-tx-s3 border-tx-bdefault text-tx-ts' : 'bg-tx-s2 border-tx-bdefault text-tx-tt'}`}>{step.nodeType}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function IvrPage() {
  const [flows, setFlows] = useState<any[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [showNewFlowInput, setShowNewFlowInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [activeSimNodeId, setActiveSimNodeId] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => { fetchFlows(); }, []);

  async function fetchFlows() {
    try { const data = await api.get('/ivr'); setFlows(data); } catch (err: any) { console.error('Failed to fetch flows', err); }
    finally { setLoading(false); }
  }

  async function createFlow() {
    const name = newFlowName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const flow = await api.post('/ivr', {
        name,
        nodes: [
          { id: '1', type: 'answer', data: {}, position: { x: 250, y: 0 } },
          { id: '2', type: 'speak', data: { text: 'Welcome. Press 1 for sales, 2 for support.' }, position: { x: 250, y: 120 } },
          { id: '3', type: 'gather', data: { maxDigits: 1, timeout: 10000, validDigits: '12' }, position: { x: 250, y: 240 } },
          { id: '4', type: 'enqueue', data: { queueName: 'sales_queue' }, position: { x: 100, y: 380 } },
          { id: '5', type: 'enqueue', data: { queueName: 'support_queue' }, position: { x: 400, y: 380 } },
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2' },
          { id: 'e2-3', source: '2', target: '3' },
          { id: 'e3-4', source: '3', target: '4', sourceHandle: '1', label: '1 — Sales' },
          { id: 'e3-5', source: '3', target: '5', sourceHandle: '2', label: '2 — Support' },
        ],
      });
      setFlows((prev) => [flow, ...prev]);
      setSelectedFlow(flow);
      setNewFlowName('');
      setShowNewFlowInput(false);
    } catch (err: any) { console.error('Failed to create flow', err); }
    finally { setCreating(false); }
  }

  async function togglePublish(flow) {
    try {
      const updated = await api.patch(`/ivr/${flow.id}/publish`, { published: !flow.published });
      setFlows((prev) => prev.map((f) => (f.id === flow.id ? { ...f, ...updated } : f)));
      if (selectedFlow?.id === flow.id) setSelectedFlow((prev) => ({ ...prev, ...updated }));
    } catch (err: any) { console.error('Failed to toggle publish', err); }
  }

  async function togglePublishGuarded(flow) {
    if (flow.published) {
      if (!confirm(`Unpublish "${flow.name}"?\n\nLive inbound calls using this flow will stop being routed. Continue?`)) return;
    }
    return togglePublish(flow);
  }

  async function deleteFlow(flow) {
    if (!confirm(`Delete "${flow.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/ivr/${flow.id}`);
      setFlows((prev) => prev.filter((f) => f.id !== flow.id));
      if (selectedFlow?.id === flow.id) setSelectedFlow(null);
    } catch (err: any) { console.error('Failed to delete flow', err); }
  }

  /* ── Validation logic ─────────────────────────────────────────── */
  const validateFlow = useCallback((nodes: any[], edges: any[]) => {
    const issues: { severity: 'error' | 'warning'; message: string; nodeId?: string }[] = [];

    // Check for answer (start) node
    const answerNodes = nodes.filter((n) => n.type === 'answer');
    if (answerNodes.length === 0) {
      issues.push({ severity: 'error', message: 'No start (Answer) node found. Every flow needs an Answer node.' });
    } else if (answerNodes.length > 1) {
      issues.push({ severity: 'warning', message: `Multiple Answer nodes found (${answerNodes.length}). Only the first connected one will execute.` });
    }

    // Check each node for issues
    for (const node of nodes) {
      const outgoingEdges = edges.filter((e) => e.source === node.id);
      const isIncoming = edges.some((e) => e.target === node.id);

      // Dangling nodes — no incoming edge (except answer nodes)
      if (node.type !== 'answer' && !isIncoming) {
        issues.push({ severity: 'warning', message: `Node "${getNodeLabel(node.type)}" (${node.id}) has no incoming connection.`, nodeId: node.id });
      }

      // Menu/gather nodes with no options
      if (node.type === 'gather' && outgoingEdges.length === 0) {
        issues.push({ severity: 'error', message: `Gather node (${node.id}) has no options connected. Callers will be stuck.`, nodeId: node.id });
      }

      // Speak/answer nodes with no outgoing edge (may end call unexpectedly)
      if ((node.type === 'speak' || node.type === 'answer') && outgoingEdges.length === 0) {
        issues.push({ severity: 'warning', message: `Node "${getNodeLabel(node.type)}" (${node.id}) has no next step. The call may end unexpectedly.`, nodeId: node.id });
      }
    }

    return issues;
  }, []);

  const runValidation = useCallback(() => {
    if (!selectedFlow) return;
    const issues = validateFlow(selectedFlow.nodes || [], selectedFlow.edges || []);
    setValidationResult(issues);
    setShowValidation(true);
  }, [selectedFlow, validateFlow]);

  const handleSave = useCallback(async (nodes: any, edges: any) => {
    if (!selectedFlow) return;
    setSaving(true);
    try {
      const updated = await api.put(`/ivr/${selectedFlow.id}`, { name: selectedFlow.name, nodes, edges });
      setFlows((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));
      setSelectedFlow((prev) => ({ ...prev, ...updated }));
    } catch (err: any) { console.error('Failed to save flow', err); }
    finally { setSaving(false); }
  }, [selectedFlow]);

  const handleToggleSimulator = useCallback(() => { setSimulating((prev) => !prev); setActiveSimNodeId(null); }, []);
  const handleCloseSimulator = useCallback(() => { setSimulating(false); setActiveSimNodeId(null); }, []);
  const handleSimNodeChange = useCallback((nodeId) => { setActiveSimNodeId(nodeId); }, []);

  const formatLastEdited = (flow) => {
    if (flow.updatedAt) return new Date(flow.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (flow.createdAt) return new Date(flow.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return 'Just now';
  };

  const getNodeLabel = (type) => {
    const labels = { answer: 'Answer', speak: 'Speak', gather: 'Gather', enqueue: 'Queue', transfer: 'Transfer', record: 'Record', hangup: 'Hangup' };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (<div key={i} className="shimmer h-24 rounded-xl" />))}
        </div>
      </div>
    );
  }

  if (selectedFlow) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-tx-bdefault bg-tx-s1/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setSelectedFlow(null); setSimulating(false); setActiveSimNodeId(null); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors text-xs font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </motion.button>
            <div className="w-px h-5 bg-tx-bdefault/40" />
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-tx-green" />
              <span className="text-sm font-semibold text-tx-tp">{selectedFlow.name}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                selectedFlow.published
                  ? 'bg-tx-green/10 text-tx-green border-tx-green/20'
                  : 'bg-tx-citron/10 text-tx-citron border-tx-citron/20'
              }`}>
                {selectedFlow.published ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Node / edge counts */}
            <span className="text-[10px] text-tx-tt font-mono tabular-nums px-2 py-1 rounded-md bg-tx-s3 border border-tx-bsubtle">
              {selectedFlow.nodes?.length || 0} nodes · {selectedFlow.edges?.length || 0} connections
            </span>

            <div className="w-px h-5 bg-tx-bdefault/40" />

            {/* Validate button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={runValidation}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                showValidation && validationResult?.length === 0
                  ? 'text-tx-green border-tx-green/30 bg-tx-green/10'
                  : 'text-tx-ts hover:text-tx-tp hover:bg-tx-s3 border-tx-bdefault'
              }`}
            >
              {showValidation && validationResult?.length === 0
                ? <CheckCircle className="w-3.5 h-3.5" />
                : <ShieldCheck className="w-3.5 h-3.5" />}
              Validate
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleToggleSimulator}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                simulating
                  ? 'text-tx-green border-tx-green/30 bg-tx-green/10'
                  : 'text-tx-ts hover:text-tx-tp hover:bg-tx-s3 border-tx-bdefault'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              {simulating ? 'Close Simulator' : 'Test Flow'}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white shadow-md shadow-tx-green/10"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => togglePublishGuarded(selectedFlow)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                selectedFlow.published
                  ? 'border-tx-citron/20 text-tx-citron hover:bg-tx-citron/10'
                  : 'border-tx-green/20 text-tx-green hover:bg-tx-green/10'
              }`}
            >
              {selectedFlow.published ? <FileEdit className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              {selectedFlow.published ? 'Unpublish' : 'Publish'}
            </motion.button>
          </div>

          {/* Validation results panel */}
          <AnimatePresence>
            {showValidation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="px-4 py-2.5 border-b border-tx-bdefault bg-tx-s1/60">
                  {validationResult == null ? null : validationResult.length === 0 ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-tx-green" />
                      <span className="text-xs font-medium text-tx-green">All checks passed — flow is valid</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {validationResult.map((issue, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          {issue.severity === "error" ? (
                            <AlertCircle className="w-3.5 h-3.5 text-tx-red mt-0.5 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-tx-citron mt-0.5 flex-shrink-0" />
                          )}
                          <span className={`text-xs ${issue.severity === "error" ? "text-tx-red" : "text-tx-citron"}`}>{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowValidation(false)}
                    className="ml-4 text-[10px] text-tx-tt hover:text-tx-tp transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0">
            <ErrorBoundary name="IVR Builder">
              <IvrBuilder
                key={selectedFlow.id}
                initialNodes={selectedFlow.nodes || []}
                initialEdges={selectedFlow.edges || []}
                onSave={handleSave}
                activeSimNodeId={activeSimNodeId}
              />
            </ErrorBoundary>
          </div>

          <AnimatePresence>
            {simulating && (
              <IvrSimulator
                flow={selectedFlow}
                onClose={handleCloseSimulator}
                onActiveNodeChange={handleSimNodeChange}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-sm flex-shrink-0">
              <GitBranch className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-tx-tp tracking-tight leading-none">IVR Flow Builder</h1>
              <p className="text-[11.5px] text-tx-tt mt-1.5">Design, test, and deploy interactive voice response flows</p>
            </div>
            <TelnyxApiInfo
              product="Call Control — IVR"
              description="Flows are executed by the Telnyx Call Control API. Each node type maps to a specific action: answer, speak (TTS), gather (DTMF), enqueue (ACD), transfer, record, or hangup."
              endpoint={['POST /v2/calls/:id/actions/answer', 'POST /v2/calls/:id/actions/speak', 'POST /v2/calls/:id/actions/gather_using_speak', 'POST /v2/calls/:id/actions/transfer', 'POST /v2/calls/:id/actions/record_start', 'POST /v2/calls/:id/actions/hangup']}
              webhook={['call.initiated', 'call.gather.ended', 'call.speak.ended']}
              docs="https://developers.telnyx.com/api/call-control"
              side="right"
            />
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowNewFlowInput(true)}
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-md gradient-primary text-white text-[13px] font-medium shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          New Flow
        </motion.button>
      </div>

      <AnimatePresence>
        {showNewFlowInput && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-4 mb-6 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-tx-green/10 border border-tx-green/20 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-tx-green" />
            </div>
            <input
              type="text"
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              placeholder="Enter flow name (e.g. Main Menu, After Hours)..."
              className="flex-1 bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') createFlow();
                if (e.key === 'Escape') { setShowNewFlowInput(false); setNewFlowName(''); }
              }}
              autoFocus
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={createFlow}
              disabled={creating || !newFlowName.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-medium shadow-lg shadow-tx-green/20 disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? 'Creating...' : 'Create'}
            </motion.button>
            <button
              onClick={() => { setShowNewFlowInput(false); setNewFlowName(''); }}
              className="px-3 py-2 rounded-xl text-sm text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {flows.length === 0 && !showNewFlowInput ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-tx-s2 border border-tx-bsubtle rounded-xl p-12 text-center flex-1 flex flex-col items-center justify-center"
        >
          <div className="w-10 h-10 rounded-xl bg-tx-s3 border border-tx-bsubtle flex items-center justify-center mb-3">
            <GitBranch className="w-4 h-4 text-tx-tt" />
          </div>
          <h3 className="text-[14px] font-semibold text-tx-tp mb-1">No IVR flows yet</h3>
          <p className="text-[12.5px] text-tx-tt mb-5 max-w-sm">Create your first flow to start building phone menus, routing logic, and automated call handling.</p>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowNewFlowInput(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-md gradient-primary text-white text-[13px] font-medium shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Create your first flow
          </motion.button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 flex-1 overflow-y-auto pb-4">
          {flows.map((flow, index) => (
            <motion.div
              key={flow.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => setSelectedFlow(flow)}
              className="bg-tx-s2 border border-tx-bsubtle rounded-xl p-4 cursor-pointer transition-colors hover:border-tx-bdefault group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                    flow.published
                      ? 'bg-tx-green/10 border border-tx-green/20'
                      : 'bg-tx-s3 border border-tx-bsubtle'
                  }`}>
                    <GitBranch className={`w-3.5 h-3.5 ${flow.published ? 'text-tx-green' : 'text-tx-ts'}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-[13px] text-tx-tp truncate group-hover:text-tx-green transition-colors">{flow.name}</h3>
                    <p className="text-[10px] text-tx-tt mt-0.5">v{flow.version} · {flow.nodes?.length || 0} nodes</p>
                  </div>
                </div>
                <span className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  flow.published
                    ? 'bg-tx-green/10 text-tx-green'
                    : 'bg-tx-s3 text-tx-tt'
                }`}>
                  {flow.published ? 'Live' : 'Draft'}
                </span>
              </div>

              <p className="text-[11.5px] text-tx-tt mb-3 line-clamp-2 leading-relaxed min-h-[2.4em]">
                {flow.nodes?.length > 0 ? (
                  flow.nodes.map((n) => getNodeLabel(n.type)).filter(Boolean).join(' → ')
                ) : (
                  <span className="italic">Empty flow — click to start editing</span>
                )}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-tx-bsubtle">
                <div className="flex items-center gap-1.5 text-[10px] text-tx-tt">
                  <Clock className="w-3 h-3" />
                  {formatLastEdited(flow)}
                </div>
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {!flow.published && (
                    <button
                      onClick={() => deleteFlow(flow)}
                      className="p-1.5 rounded-lg text-tx-tt hover:text-tx-red hover:bg-tx-red/10 transition-colors"
                      title="Delete flow"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => togglePublishGuarded(flow)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                      flow.published
                        ? 'bg-tx-citron/10 text-tx-citron border border-tx-citron/20 hover:bg-tx-citron/20'
                        : 'bg-tx-green/10 text-tx-green border border-tx-green/20 hover:bg-tx-green/20'
                    }`}
                  >
                    {flow.published ? <FileEdit className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                    {flow.published ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
