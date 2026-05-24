'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../lib/api';
import TelnyxApiInfo from '../../../components/TelnyxApiInfo';
import {
  Hash,
  Plus,
  X,
  Phone,
  GitBranch,
  Link2,
  PhoneCall,
  MessageSquare,
  MoreHorizontal,
  Unlink,
  Trash2,
  Filter,
  Check,
  AlertCircle,
  Search,
  Copy,
} from 'lucide-react';

const FILTER_TABS = [
  { id: 'all', label: 'All Numbers' },
  { id: 'active', label: 'Active' },
  { id: 'unassigned', label: 'Unassigned' },
];

const TYPE_FILTERS = [
  { id: '', label: 'All Types' },
  { id: 'local', label: 'Local' },
  { id: 'toll_free', label: 'Toll-free' },
  { id: 'mobile', label: 'Mobile' },
];

const CAPABILITY_FILTERS = [
  { id: '', label: 'All' },
  { id: 'voice', label: 'Voice' },
  { id: 'sms', label: 'SMS' },
];

function formatPhoneNumber(phone) {
  if (!phone) return '—';
  const cleaned = phone.replace(/^\+/, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('61')) {
    return `+61 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return `+${cleaned}`;
}

export default function NumbersPage() {
  const [numbers, setNumbers] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ phoneNumber: '', ivrFlowId: '', connectionId: '', messagingProfileId: '', countryCode: '', numberType: '', label: '' });
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (openMenuId) setOpenMenuId(null);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [openMenuId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [nums, fls] = await Promise.all([api.get('/numbers'), api.get('/ivr')]);
      setNumbers(nums);
      setFlows(fls);
    } catch (err: any) { console.error('Failed to fetch data', err); }
    finally { setLoading(false); }
  }

  async function addNumber(e) {
    e.preventDefault();
    setError('');
    try {
      const num = await api.post('/numbers', addForm);
      setNumbers((prev) => [...prev, num]);
      setAddForm({ phoneNumber: '', ivrFlowId: '', connectionId: '', messagingProfileId: '', countryCode: '', numberType: '', label: '' });
      setShowAdd(false);
    } catch (err: any) { setError(err.data?.error || 'Failed to add number'); }
  }

  async function assignFlow(numberId, ivrFlowId) {
    try {
      const updated = await api.patch(`/numbers/${numberId}`, { ivrFlowId });
      setNumbers((prev) => prev.map((n) => (n.id === numberId ? { ...n, ...updated } : n)));
    } catch (err: any) { console.error('Failed to assign flow', err); }
  }

  async function releaseNumber(numberId) {
    if (!confirm('Release this number? It will be removed from your account and cannot be recovered.')) return;
    try {
      await api.delete(`/numbers/${numberId}`);
      setNumbers((prev) => prev.filter((n) => n.id !== numberId));
    } catch (err: any) { console.error('Failed to release number', err); }
  }

  async function unassignFlow(numberId) {
    try {
      const updated = await api.patch(`/numbers/${numberId}`, { ivrFlowId: null });
      setNumbers((prev) => prev.map((n) => (n.id === numberId ? { ...n, ...updated } : n)));
    } catch (err: any) { console.error('Failed to unassign flow', err); }
  }

  const filteredNumbers = numbers.filter((num) => {
    // Status filter
    if (activeFilter === 'active' && !num.ivrFlowId && !num.connectionId) return false;
    if (activeFilter === 'unassigned' && (num.ivrFlowId || num.connectionId)) return false;
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const phoneMatch = (num.phoneNumber || '').toLowerCase().includes(q);
      const labelMatch = (num.label || '').toLowerCase().includes(q);
      if (!phoneMatch && !labelMatch) return false;
    }
    // Type filter
    if (typeFilter) {
      if (typeFilter === 'mobile' && (num.numberType !== 'mobile' && num.numberType !== 'local')) return false;
      if (typeFilter !== 'mobile' && num.numberType !== typeFilter) return false;
    }
    // Capability filter
    if (capabilityFilter === 'voice' && !num.connectionId) return false;
    if (capabilityFilter === 'sms' && !num.messagingProfileId) return false;
    return true;
  });

  const activeCount = numbers.filter((n) => n.ivrFlowId || n.connectionId).length;
  const unassignedCount = numbers.filter((n) => !n.ivrFlowId && !n.connectionId).length;

  function copyToClipboard(phoneNumber: string, numId: string) {
    navigator.clipboard.writeText(phoneNumber).then(() => {
      setCopiedId(numId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (<div key={i} className="shimmer h-24 rounded-xl" />))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-tx-green/20 flex-shrink-0">
              <Phone className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-tx-tp tracking-tight">Phone Numbers</h1>
                <TelnyxApiInfo
                  product="Numbers API"
                  description="Phone numbers are provisioned through Telnyx and assigned to a Call Control connection. When a call arrives on a number, Telnyx fires a webhook to your server which runs the assigned IVR flow."
                  endpoint={['GET /v2/phone_numbers', 'PATCH /v2/phone_numbers/:id']}
                  webhook={['call.initiated']}
                  docs="https://developers.telnyx.com/api/numbers"
                  side="right"
                />
              </div>
              <p className="text-sm text-tx-ts mt-0.5">Manage inbound numbers and IVR assignments</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-tx-ts hover:text-tx-tp hover:bg-tx-s3 border border-tx-bdefault transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Number
          </motion.button>

        </div>
      </div>

      {/* Add number form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-tx-tp">Add Phone Number</h2>
                <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {error && (
                <div className="bg-tx-red/10 border border-tx-red/20 text-tx-red px-4 py-3 rounded-xl mb-4 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <form onSubmit={addNumber} className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-tx-ts mb-1.5">Phone Number *</label>
                  <input type="tel" value={addForm.phoneNumber} onChange={(e) => setAddForm((f) => ({ ...f, phoneNumber: e.target.value }))} placeholder="+61412345678" className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tx-ts mb-1.5">IVR Flow</label>
                  <select value={addForm.ivrFlowId} onChange={(e) => setAddForm((f) => ({ ...f, ivrFlowId: e.target.value }))} className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] appearance-none">
                    <option value="">— None —</option>
                    {flows.map((flow) => (<option key={flow.id} value={flow.id} className="bg-tx-s1">{flow.name} {flow.published ? '(Live)' : '(Draft)'}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-tx-ts mb-1.5">Connection ID</label>
                  <input type="text" value={addForm.connectionId} onChange={(e) => setAddForm((f) => ({ ...f, connectionId: e.target.value }))} placeholder="Telnyx Connection ID" className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tx-ts mb-1.5">Messaging Profile ID</label>
                  <input type="text" value={addForm.messagingProfileId} onChange={(e) => setAddForm((f) => ({ ...f, messagingProfileId: e.target.value }))} placeholder="Telnyx Messaging Profile ID" className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tx-ts mb-1.5">Country (ISO)</label>
                  <input type="text" value={addForm.countryCode} onChange={(e) => setAddForm((f) => ({ ...f, countryCode: e.target.value.toUpperCase().slice(0,2) }))} placeholder="AU" maxLength={2} className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tx-ts mb-1.5">Number Type</label>
                  <select value={addForm.numberType} onChange={(e) => setAddForm((f) => ({ ...f, numberType: e.target.value }))} className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] appearance-none">
                    <option value="">— Select —</option>
                    <option value="local" className="bg-tx-s1">Local (10DLC)</option>
                    <option value="toll_free" className="bg-tx-s1">Toll-Free</option>
                    <option value="short_code" className="bg-tx-s1">Short Code</option>
                    <option value="alphanumeric" className="bg-tx-s1">Alphanumeric</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-tx-ts mb-1.5">Label</label>
                  <input type="text" value={addForm.label} onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. 10DLC Marketing" className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]" />
                </div>
                <div className="col-span-3">
                  <button type="submit" className="px-6 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium shadow-lg shadow-tx-green/20">Add Number</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + Filter bar */}
      {numbers.length > 0 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {/* Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tx-tt" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by number or name…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-tp text-sm placeholder:text-tx-tt focus:outline-none focus:border-tx-green/50 transition-colors"
            />
          </div>

          {/* Type filter pills */}
          <div className="flex items-center gap-1">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors border ${
                  typeFilter === f.id
                    ? 'bg-tx-green/15 border-tx-green/30 text-tx-green'
                    : 'bg-tx-s3 border-tx-bdefault text-tx-ts hover:text-tx-tp'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Capability filter pills */}
          <div className="flex items-center gap-1">
            {CAPABILITY_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setCapabilityFilter(f.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors border ${
                    capabilityFilter === f.id
                      ? 'bg-tx-green/15 border-tx-green/30 text-tx-green'
                      : 'bg-tx-s3 border-tx-bdefault text-tx-ts hover:text-tx-tp'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Count */}
          <span className="text-[11px] text-tx-ts ml-auto">
            <span className="font-semibold text-tx-tp">{filteredNumbers.length}</span> of <span className="font-semibold text-tx-tp">{numbers.length}</span> numbers
          </span>
        </div>
      )}

      {/* Filter tabs */}
      {numbers.length > 0 && (
        <div className="flex items-center gap-1 mb-6 p-1 bg-tx-s3 rounded-xl w-fit">
          {FILTER_TABS.map((tab) => {
            const count = tab.id === 'all' ? numbers.length : tab.id === 'active' ? activeCount : unassignedCount;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeFilter === tab.id
                    ? 'bg-tx-s1 text-tx-tp shadow-sm'
                    : 'text-tx-ts hover:text-tx-tp'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                  activeFilter === tab.id ? 'bg-tx-green/10 text-tx-green' : 'bg-tx-s2 text-tx-tt'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Number cards */}
      {numbers.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-16 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-tx-s3 flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-tx-tt" />
          </div>
          <h3 className="text-lg font-semibold text-tx-tp mb-1">No phone numbers configured</h3>
          <p className="text-sm text-tx-ts mb-6 max-w-sm mx-auto">Add or purchase a number and assign it to an IVR flow to start receiving calls.</p>
          <div className="flex items-center justify-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-tx-ts hover:text-tx-tp border border-tx-bdefault hover:bg-tx-s3 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Number
            </motion.button>

          </div>
        </motion.div>
      ) : filteredNumbers.length === 0 ? (
        <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-12 text-center">
          <Filter className="w-8 h-8 text-tx-tt mx-auto mb-3" />
          <p className="text-sm text-tx-ts">No numbers match the selected filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredNumbers.map((num, index) => {
            const isAssigned = !!(num.ivrFlowId || num.connectionId);
            const flowObj = num.ivrFlow || flows.find((f) => f.id === num.ivrFlowId);
            return (
              <motion.div
                key={num.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-5 group"
              >
                {/* Phone number + status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-tx-tp font-mono tracking-wide">
                        {formatPhoneNumber(num.phoneNumber)}
                      </p>
                      {/* Copy Number button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(num.phoneNumber, num.id); }}
                        className="p-1 rounded-md text-tx-tt hover:text-tx-ts hover:bg-tx-s3 transition-colors"
                        title="Copy number"
                      >
                        {copiedId === num.id
                          ? <Check className="w-3.5 h-3.5 text-tx-green" />
                          : <Copy className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${isAssigned ? 'bg-tx-green' : 'bg-tx-citron'}`} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-tx-ts">
                        {isAssigned ? 'Active' : 'Unassigned'}
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === num.id ? null : num.id); }}
                      className="p-1.5 rounded-lg text-tx-tt hover:text-tx-ts hover:bg-tx-s3 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {openMenuId === num.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.1 }}
                          className="absolute right-0 top-8 z-10 w-44 bg-tx-s2 border border-tx-bdefault rounded-2xl py-1 shadow-xl border border-tx-bdefault"
                          onClick={(e) => e.stopPropagation()}
                        >

                          {num.ivrFlowId && (
                            <button
                              onClick={() => { unassignFlow(num.id); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                              Unassign Flow
                            </button>
                          )}
                          <div className="border-t border-tx-bdefault my-1" />
                          <button
                            onClick={() => { releaseNumber(num.id); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-tx-red hover:bg-tx-red/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Release Number
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Label + type badges */}
                {(num.label || num.numberType) && (
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    {num.numberType && (
                      <span className="px-1.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] font-semibold uppercase tracking-wider">
                        {num.numberType.replace('_', ' ')}
                      </span>
                    )}
                    {num.countryCode && (
                      <span className="px-1.5 py-0.5 rounded-md bg-tx-s3 border border-tx-bdefault text-tx-ts text-[9px] font-semibold uppercase">
                        {num.countryCode}
                      </span>
                    )}
                    {num.label && (
                      <span className="text-[10px] text-tx-tt truncate">{num.label}</span>
                    )}
                  </div>
                )}

                {/* Connection */}
                <div className="mb-3">
                  <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Connection</span>
                  <p className="text-xs text-tx-ts mt-0.5 font-mono truncate">
                    {num.connectionId || 'No connection assigned'}
                  </p>
                </div>

                {/* Messaging Profile */}
                {num.messagingProfileId && (
                  <div className="mb-3">
                    <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Messaging Profile</span>
                    <p className="text-xs text-tx-ts mt-0.5 font-mono truncate">{num.messagingProfileId}</p>
                  </div>
                )}

                {/* IVR Flow assignment */}
                <div className="mb-3">
                  <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">IVR Flow</span>
                  {flowObj ? (
                    <div className="flex items-center gap-2 mt-1">
                      <GitBranch className="w-3.5 h-3.5 text-tx-ts" />
                      <span className="text-xs text-tx-tp">{flowObj.name}</span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${
                        flowObj.published
                          ? 'bg-tx-green/10 text-tx-green border-tx-green/20'
                          : 'bg-tx-citron/10 text-tx-citron border-tx-citron/20'
                      }`}>
                        {flowObj.published ? 'Live' : 'Draft'}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <select
                        value={num.ivrFlowId || ''}
                        onChange={(e) => assignFlow(num.id, e.target.value)}
                        className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-2 py-1.5 text-xs text-tx-ts focus:outline-none appearance-none hover:border-tx-green/30 transition-colors"
                      >
                        <option value="" className="bg-tx-s1">Assign a flow...</option>
                        {flows.map((flow) => (<option key={flow.id} value={flow.id} className="bg-tx-s1">{flow.name} {flow.published ? '(Live)' : '(Draft)'}</option>))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Feature badges */}
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-tx-s3 text-[10px] font-bold text-tx-tt uppercase tracking-widest">
                    <PhoneCall className="w-3 h-3 text-tx-green" />
                    Voice
                  </span>
                  <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-tx-s3 text-[10px] font-bold text-tx-tt uppercase tracking-widest">
                    <MessageSquare className="w-3 h-3 text-blue-400" />
                    SMS
                  </span>

                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-tx-bdefault">
                  <span className="text-[10px] text-tx-tt">
                    Added {new Date(num.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-tx-green animate-pulse" />
                    <span className="text-[10px] text-tx-green font-medium">Connected</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}


    </div>
  );
}
