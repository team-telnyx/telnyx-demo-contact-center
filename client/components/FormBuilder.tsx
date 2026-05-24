'use client';

import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, GripVertical,
  ChevronDown, ChevronRight, X, Sparkles, Settings,
  Eye, Edit3, History, BarChart3,
} from 'lucide-react';
import api from '../lib/api';
import { FIELD_TYPES, FIELD_CATEGORIES, createDefaultField, createEmptySchema } from '../lib/form-field-types';
import FormAIGenerate from './FormAIGenerate';
import FormRenderer from './FormRenderer';
import { useToast } from './Toast';

const INP = 'w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-2.5 py-1.5 text-[12px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40';
const SEL = 'w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-2.5 py-1.5 text-[12px] text-tx-tp focus:outline-none focus:border-tx-citron/40';
const LBL = 'text-[11px] font-medium text-tx-ts mb-1 block';
const SM_INP = 'w-full bg-tx-s2 border border-tx-bdefault rounded px-1.5 py-1 text-[10px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40';
const SM_SEL = 'w-full bg-tx-s2 border border-tx-bdefault rounded px-1.5 py-1 text-[10px] text-tx-tp focus:outline-none focus:border-tx-citron/40';

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState<string>('');
  function add() { const t = input.trim().toLowerCase(); if (t && !tags.includes(t)) onChange([...tags, t]); setInput(''); }
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1">{tags.map(tag => (
        <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-tx-citron/10 text-tx-citron text-[10px] rounded border border-tx-citron/20">{tag}<button onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:text-tx-citron/60">×</button></span>
      ))}</div>
      <div className="flex gap-1">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())} className="flex-1 bg-tx-s3 border border-tx-bdefault rounded px-1.5 py-1 text-[10px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40" placeholder="Add tag..." />
        <button onClick={add} className="px-2 py-1 bg-tx-s2 border border-tx-bdefault rounded text-[10px] text-tx-ts hover:text-tx-tp transition-colors">Add</button>
      </div>
    </div>
  );
}

function FieldPalette() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const grouped = useMemo(() => { const map = {}; for (const [type, def] of Object.entries(FIELD_TYPES)) { const cat = def.category; if (!map[cat]) map[cat] = []; map[cat].push({ type, ...def }); } return map; }, []);
  return (
    <div className="w-[250px] flex-shrink-0 border-r border-tx-bdefault bg-tx-s1 overflow-y-auto">
      <div className="px-3 py-3 border-b border-tx-bdefault"><h3 className="text-[12px] font-semibold text-tx-tp">Field Types</h3><p className="text-[10px] text-tx-tt mt-0.5">Drag onto the canvas</p></div>
      <div className="p-2 space-y-1">
        {Object.entries(FIELD_CATEGORIES).map(([catKey, catDef]) => { const fields = grouped[catKey]; if (!fields?.length) return null; const isCollapsed = collapsed[catKey]; return (
          <div key={catKey}>
            <button onClick={() => setCollapsed(c => ({ ...c, [catKey]: !c }))} className="flex items-center gap-2 w-full px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-tx-ts hover:text-tx-tp transition-colors">{isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}{catDef.label}</button>
            <AnimatePresence>{!isCollapsed && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden"><div className="space-y-1 pl-1 pb-1">{fields.map(f => { const Icon = f.icon; return (<div key={f.type} draggable onDragStart={(e: any) => { e.dataTransfer?.setData('fieldType', f.type); e.dataTransfer && (e.dataTransfer.effectAllowed = 'copy'); }} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-tx-s2 border border-tx-bsubtle hover:border-tx-citron/30 cursor-grab active:cursor-grabbing hover:bg-tx-s3 transition-all group"><Icon className="w-3.5 h-3.5 text-tx-ts group-hover:text-tx-citron transition-colors flex-shrink-0" strokeWidth={1.5} /><span className="text-[11px] font-medium text-tx-tp group-hover:text-tx-citron transition-colors">{f.label}</span></div>); })}</div></motion.div>)}</AnimatePresence>
          </div>
        ); })}
      </div>
    </div>
  );
}

function FormCanvas({ schema, selectedFieldId, onSelectField, onUpdateSchema, activePageIndex, setActivePageIndex }: {
  schema: any;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onUpdateSchema: (schema: any) => void;
  activePageIndex: number;
  setActivePageIndex: (idx: number) => void;
}) {
  const [dragOverIdx, setDragOverIdx] = useState<string | null>(null);
  const activePage = schema.pages?.[activePageIndex];
  const handleDrop = useCallback((e: React.DragEvent, sectionIdx: number, insertIdx: number) => { e.preventDefault(); setDragOverIdx(null); const fieldType = e.dataTransfer.getData('fieldType'); const movedFieldId = e.dataTransfer.getData('fieldId'); const newSchema = { ...schema, pages: schema.pages.map((p, i) => i === activePageIndex ? { ...p, sections: p.sections.map(s => ({ ...s, fields: [...s.fields] })) } : p) }; const sections = newSchema.pages[activePageIndex].sections; if (fieldType) { const nf = createDefaultField(fieldType); sections[sectionIdx].fields.splice(insertIdx, 0, nf); onUpdateSchema(newSchema); onSelectField(nf.id); } else if (movedFieldId) { let mf = null; for (const sec of sections) { const idx = sec.fields.findIndex(f => f.id === movedFieldId); if (idx !== -1) { mf = sec.fields.splice(idx, 1)[0]; break; } } if (mf) { sections[sectionIdx].fields.splice(insertIdx, 0, mf); onUpdateSchema(newSchema); } } }, [schema, activePageIndex, onUpdateSchema, onSelectField]);
  const removeField = (sIdx, fIdx) => { const ns = { ...schema, pages: schema.pages.map((p, i) => i !== activePageIndex ? p : { ...p, sections: p.sections.map((s, j) => j !== sIdx ? s : { ...s, fields: s.fields.filter((_, k) => k !== fIdx) }) }) }; onUpdateSchema(ns); };
  const updateSectionTitle = (sIdx, title) => { const ns = { ...schema, pages: schema.pages.map((p, i) => i !== activePageIndex ? p : { ...p, sections: p.sections.map((s, j) => j !== sIdx ? s : { ...s, title }) }) }; onUpdateSchema(ns); };
  const addSection = () => { const ns = { ...schema, pages: schema.pages.map((p, i) => i !== activePageIndex ? p : { ...p, sections: [...p.sections, { id: crypto.randomUUID(), title: `Section ${p.sections.length + 1}`, fields: [] }] }) }; onUpdateSchema(ns); };
  const addPage = () => { const idx = schema.pages.length; const ns = { ...schema, pages: [...schema.pages, { id: crypto.randomUUID(), title: `Page ${idx + 1}`, sections: [{ id: crypto.randomUUID(), title: 'Section 1', fields: [] }] }] }; onUpdateSchema(ns); setActivePageIndex(idx); };
  const removePage = (pIdx) => { if (schema.pages.length <= 1) return; const ns = { ...schema, pages: schema.pages.filter((_, i) => i !== pIdx) }; onUpdateSchema(ns); if (activePageIndex >= ns.pages.length) setActivePageIndex(ns.pages.length - 1); };
  const removeSection = (sIdx) => { const ns = { ...schema, pages: schema.pages.map((p, i) => i !== activePageIndex ? p : { ...p, sections: p.sections.filter((_, j) => j !== sIdx) }) }; onUpdateSchema(ns); };

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-tx-bdefault bg-tx-s1/50 overflow-x-auto flex-shrink-0">
        {schema.pages.map((page, pIdx) => (<div key={page.id} className="flex items-center gap-1"><button onClick={() => setActivePageIndex(pIdx)} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${pIdx === activePageIndex ? 'bg-tx-citron/10 text-tx-citron border border-tx-citron/20' : 'text-tx-ts hover:text-tx-tp hover:bg-tx-s2 border border-transparent'}`}>{page.title}</button>{schema.pages.length > 1 && <button onClick={() => removePage(pIdx)} className="w-5 h-5 rounded flex items-center justify-center text-tx-tt hover:text-tx-red transition-colors"><X className="w-3 h-3" /></button>}</div>))}
        <button onClick={addPage} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] text-tx-tt hover:text-tx-citron hover:bg-tx-s2 transition-all"><Plus className="w-3 h-3" /> Add Page</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {activePage?.sections?.map((section, sIdx) => (
            <div key={section.id} className="rounded-xl bg-tx-s2 border border-tx-bdefault overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-tx-s3/50 border-b border-tx-bdefault">
                <input type="text" value={section.title} onChange={e => updateSectionTitle(sIdx, e.target.value)} className="bg-transparent border-none text-[12px] font-semibold text-tx-tp focus:outline-none flex-1" />
                {activePage.sections.length > 1 && <button onClick={() => removeSection(sIdx)} className="w-6 h-6 rounded-md hover:bg-tx-red/10 flex items-center justify-center text-tx-tt hover:text-tx-red transition-colors"><Trash2 className="w-3 h-3" /></button>}
              </div>
              <div className="p-3 space-y-2 min-h-[60px]">
                {section.fields.map((field, fIdx) => { const fieldDef = FIELD_TYPES[field.type]; const FieldIcon = fieldDef?.icon || Edit3; const isSelected = selectedFieldId === field.id; return (
                  <motion.div key={field.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} draggable onDragStart={(e: any) => { e.dataTransfer?.setData('fieldId', field.id); e.dataTransfer && (e.dataTransfer.effectAllowed = 'move'); }} onClick={() => onSelectField(field.id)} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-tx-citron/5 border-tx-citron/30 ring-1 ring-tx-citron/20' : 'bg-tx-s1 border-tx-bsubtle hover:border-tx-bdefault'}`}>
                    <GripVertical className="w-3.5 h-3.5 text-tx-tt flex-shrink-0 cursor-grab active:cursor-grabbing" />
                    <FieldIcon className="w-4 h-4 text-tx-ts flex-shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0"><p className="text-[12px] font-medium text-tx-tp truncate">{field.label}</p>{field.variable && <p className="text-[10px] text-tx-tt truncate">${'{' + field.variable + '}'}</p>}</div>
                    {field.required && <span className="text-[9px] text-tx-red font-bold">*</span>}
                    {field.props?.visibility?.type === 'conditional' && <span className="text-[8px] px-1.5 py-0.5 rounded bg-tx-blue/10 text-tx-blue border border-tx-blue/20 font-semibold">COND</span>}
                    <button onClick={e => { e.stopPropagation(); removeField(sIdx, fIdx); }} className="w-5 h-5 rounded flex items-center justify-center text-tx-tt hover:text-tx-red transition-colors flex-shrink-0"><X className="w-3 h-3" /></button>
                  </motion.div>
                ); })}
                <div onDragOver={(e: React.DragEvent) => { e.preventDefault(); setDragOverIdx(`${sIdx}-${section.fields.length}`); }} onDragLeave={() => setDragOverIdx(null)} onDrop={(e: React.DragEvent) => handleDrop(e, sIdx, section.fields.length)} className={`border-2 border-dashed rounded-lg py-3 text-center text-[11px] transition-all ${dragOverIdx === `${sIdx}-${section.fields.length}` ? 'border-tx-citron/40 bg-tx-citron/5 text-tx-citron' : 'border-tx-bsubtle text-tx-tt hover:border-tx-bdefault'}`}>Drop field here</div>
              </div>
            </div>
          ))}
          <button onClick={addSection} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-tx-bdefault hover:border-tx-citron/30 text-tx-tt hover:text-tx-citron transition-all text-[12px] font-medium"><Plus className="w-3.5 h-3.5" /> Add Section</button>
        </div>
      </div>
    </div>
  );
}

export default function FormBuilder({ form: initialForm, onSave, onBack }: { form: any; onSave?: (form: any) => void; onBack: () => void }) {
  const [schema, setSchema] = useState<any>(initialForm.schema || createEmptySchema(initialForm.name));
  const [form, setForm] = useState<any>(initialForm);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [showAIGenerate, setShowAIGenerate] = useState<boolean>(false);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersions, setShowVersions] = useState<boolean>(false);
  const { addToast } = useToast();

  useEffect(() => { if (form.id) { api.get(`/forms/${form.id}/versions`).then(({ data }) => setVersions(data || [])).catch(() => {}); } }, [form.id]);

  const updateSchema = useCallback((ns: any) => { setSchema(ns); }, []);
  const updateField = useCallback((fieldId: string | null, updates: any) => { if (!fieldId) { setSelectedFieldId(null); return; } setSchema(prev => ({ ...prev, pages: prev.pages.map(page => ({ ...page, sections: page.sections.map(section => ({ ...section, fields: section.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f) })) })) })); }, []);

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      const { data } = await api.put(`/forms/${form.id}`, { schema, settings: form.settings, category: form.category, tags: form.tags });
      setSchema(data.schema || schema); setForm(data); onSave?.(data); addToast('Form saved successfully', 'success');
      const { data: nv } = await api.get(`/forms/${form.id}/versions`).catch(() => ({ data: [] }));
      if (nv) setVersions(nv);
    } catch (err: any) { console.error('Save failed:', err); addToast('Failed to save form', 'error'); } finally { setSaving(false); }
  }

  async function handleRestoreVersion(version: number): Promise<void> {
    if (!confirm(`Restore to version ${version}? This will create a new version.`)) return;
    try { const { data } = await api.post(`/forms/${form.id}/versions/${version}/restore`); setForm(data); setSchema(data.schema || schema); const { data: nv } = await api.get(`/forms/${form.id}/versions`); setVersions(nv || []); setShowVersions(false); addToast(`Restored to version ${version}`, 'success'); }
    catch (err: any) { console.error('Restore failed:', err); addToast('Failed to restore version', 'error'); }
  }

  function handleAIGenerated(gs: any): void { setSchema(gs); setShowAIGenerate(false); addToast('AI-generated form applied', 'success'); }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-tx-bdefault bg-tx-s1 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 rounded-lg hover:bg-tx-s2 flex items-center justify-center text-tx-ts hover:text-tx-tp transition-colors"><ArrowLeft className="w-4 h-4" /></button>
          <div><h1 className="text-[14px] font-bold text-tx-tp">{schema.name || 'Form Builder'}</h1><p className="text-[10px] text-tx-tt">{form.id ? `ID: ${form.id.slice(0, 8)}...` : 'New form'}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowVersions(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-tx-s2 border border-tx-bdefault text-tx-ts text-[11px] font-medium hover:text-tx-tp hover:border-tx-citron/30 transition-all"><History className="w-3.5 h-3.5" /> v{form.version || 1}</button>
          <button onClick={() => window.open(`/forms/${form.id}/analytics`, '_self')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-tx-s2 border border-tx-bdefault text-tx-ts text-[11px] font-medium hover:text-tx-tp hover:border-tx-citron/30 transition-all"><BarChart3 className="w-3.5 h-3.5" /> Analytics</button>
          <button onClick={() => setShowAIGenerate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-s2 border border-tx-bdefault text-tx-citron text-[11px] font-semibold hover:border-tx-citron/30 transition-all"><Sparkles className="w-3 h-3" /> AI Generate</button>
          <button onClick={() => setShowPreview(!showPreview)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-s2 border border-tx-bdefault text-tx-ts text-[11px] font-medium hover:text-tx-tp transition-all ${showPreview ? 'border-tx-citron/30 text-tx-citron' : ''}`}><Eye className="w-3 h-3" /> {showPreview ? 'Edit' : 'Preview'}</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg gradient-primary text-tx-ti text-[11px] font-semibold disabled:opacity-50 transition-all">{saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save</button>
        </div>
      </div>
      {showPreview ? (
        <div className="flex-1 overflow-y-auto p-6 bg-tx-s0"><div className="max-w-2xl mx-auto"><FormRenderer schema={schema} /></div></div>
      ) : (
        <div className="flex flex-1 min-h-0">
          <FieldPalette />
          <FormCanvas schema={schema} selectedFieldId={selectedFieldId} onSelectField={setSelectedFieldId} onUpdateSchema={updateSchema} activePageIndex={activePageIndex} setActivePageIndex={setActivePageIndex} />
          <FieldEditor schema={schema} selectedFieldId={selectedFieldId} onUpdateSchema={updateSchema} onUpdateField={updateField} onSelectField={setSelectedFieldId} form={form} setForm={setForm} />
        </div>
      )}
      <AnimatePresence>{showAIGenerate && <FormAIGenerate onApply={handleAIGenerated} onClose={() => setShowAIGenerate(false)} />}</AnimatePresence>
      {showVersions && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowVersions(false)} />
          <div className="relative w-80 bg-tx-s1 border-l border-tx-bdefault overflow-y-auto">
            <div className="p-4 border-b border-tx-bdefault flex items-center justify-between"><h3 className="text-sm font-semibold text-tx-tp">Version History</h3><button onClick={() => setShowVersions(false)} className="text-tx-ts hover:text-tx-tp text-lg">×</button></div>
            <div className="p-4 space-y-2">
              {versions.length === 0 && <p className="text-[11px] text-tx-tt text-center py-6">No version history yet.</p>}
              {versions.map(v => (<div key={v.id || v.version} className={`p-3 rounded-lg border ${v.version === form.version ? 'border-tx-citron/30 bg-tx-citron/5' : 'border-tx-bdefault bg-tx-s2'}`}><div className="flex items-center justify-between"><span className="text-xs font-semibold text-tx-tp">v{v.version}</span><span className="text-[10px] text-tx-tt">{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : ''}</span></div>{v.changeNote && <p className="text-[10px] text-tx-ts mt-1">{v.changeNote}</p>}{v.version !== form.version && <button onClick={() => handleRestoreVersion(v.version)} className="mt-2 text-[10px] text-tx-citron hover:text-tx-citron/80 font-medium">Restore this version</button>}</div>))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* === FIELDEDITOR: Full implementation === */
function FieldEditor({ schema, selectedFieldId, onUpdateSchema, onUpdateField, onSelectField, form, setForm }) {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [pexelsQuery, setPexelsQuery] = useState('');
  const [pexelsResults, setPexelsResults] = useState<any[]>([]);
  const [pexelsLoading, setPexelsLoading] = useState(false);
  const [showPexels, setShowPexels] = useState(false);

  const selectedField = useMemo(() => { if (!selectedFieldId) return null; for (const page of schema.pages || []) { for (const section of page.sections || []) { const f = section.fields?.find(f => f.id === selectedFieldId); if (f) return f; } } return null; }, [schema, selectedFieldId]);
  const otherFields = useMemo(() => { const fields = []; for (const page of schema.pages || []) { for (const section of page.sections || []) { for (const f of section.fields || []) { if (f.id !== selectedFieldId && f.variable) fields.push({ id: f.id, variable: f.variable, label: f.label, type: f.type }); } } } return fields; }, [schema, selectedFieldId]);

  useEffect(() => { api.get('/workflows').then(({ data }) => setWorkflows(data || [])).catch(() => {}); }, []);

  const searchPexels = async () => { if (!pexelsQuery.trim()) return; setPexelsLoading(true); try { const { data } = await api.get(`/forms/pexels/search?query=${encodeURIComponent(pexelsQuery)}`); setPexelsResults(data?.photos || data || []); } catch { setPexelsResults([]); } finally { setPexelsLoading(false); } };

  const ufp = (key, value) => { if (!selectedField) return; onUpdateField(selectedField.id, { props: { ...selectedField.props, [key]: value } }); };
  const uf = (key, value) => { if (!selectedField) return; onUpdateField(selectedField.id, { [key]: value }); };
  const uo = (idx, value) => { if (!selectedField) return; const o = [...(selectedField.options || [])]; o[idx] = value; onUpdateField(selectedField.id, { options: o }); };
  const ao = () => { if (!selectedField) return; onUpdateField(selectedField.id, { options: [...(selectedField.options || []), `Option ${(selectedField.options?.length || 0) + 1}`] }); };
  const ro = (idx) => { if (!selectedField) return; onUpdateField(selectedField.id, { options: selectedField.options.filter((_, i) => i !== idx) }); };

  /* Conditional Logic */
  function addCondition() { const v = selectedField.props?.visibility || { type: 'conditional', conditions: [], logic: 'and' }; ufp('visibility', { ...v, conditions: [...(v.conditions || []), { fieldId: '', operator: 'eq', value: '' }] }); }
  function updateCondition(i, k, val) { const v = { ...selectedField.props.visibility }; const c = [...v.conditions]; c[i] = { ...c[i], [k]: val }; ufp('visibility', { ...v, conditions: c }); }
  function removeCondition(i) { const v = { ...selectedField.props.visibility }; ufp('visibility', { ...v, conditions: v.conditions.filter((_, j) => j !== i) }); }

  /* Validation */
  function ufv(key, value) { const v = { ...selectedField.validation }; if (value === undefined) delete v[key]; else v[key] = value; onUpdateField(selectedField.id, { validation: v }); }
  function addCustomRule() { const v = { ...selectedField.validation }; onUpdateField(selectedField.id, { validation: { ...v, customRules: [...(v.customRules || []), { type: 'crossField', fieldVariable: '', operator: 'eq', message: '' }] } }); }
  function updateCustomRule(i, k, val) { const v = { ...selectedField.validation }; const r = [...v.customRules]; r[i] = { ...r[i], [k]: val }; onUpdateField(selectedField.id, { validation: { ...v, customRules: r } }); }
  function removeCustomRule(i) { const v = { ...selectedField.validation }; onUpdateField(selectedField.id, { validation: { ...v, customRules: v.customRules.filter((_, j) => j !== i) } }); }

  /* Form Settings */
  function us(partial) { setForm({ ...form, settings: { ...form.settings, ...partial } }); }
  function addCalcField() { us({ calculatedFields: [...(form.settings?.calculatedFields || []), { variable: '', label: '', formula: '', format: 'number' }] }); }
  function updateCalcField(i, k, v) { const f = [...(form.settings?.calculatedFields || [])]; f[i] = { ...f[i], [k]: v }; us({ calculatedFields: f }); }
  function removeCalcField(i) { us({ calculatedFields: form.settings.calculatedFields.filter((_, j) => j !== i) }); }

  /* ── NO FIELD SELECTED: Enhanced Form Settings ── */
  if (!selectedField) {
    return (
      <div className="w-[320px] flex-shrink-0 border-l border-tx-bdefault bg-tx-s1 overflow-y-auto">
        <div className="px-4 py-3 border-b border-tx-bdefault"><div className="flex items-center gap-2"><Settings className="w-4 h-4 text-tx-citron" /><h3 className="text-[12px] font-semibold text-tx-tp">Form Settings</h3></div></div>
        <div className="p-3 space-y-3">
          {/* Name & Description */}
          <div><label className={LBL}>Form Name</label><input type="text" value={schema.name} onChange={e => onUpdateSchema({ ...schema, name: e.target.value })} className={INP} /></div>
          <div><label className={LBL}>Description</label><textarea value={schema.description} onChange={e => onUpdateSchema({ ...schema, description: e.target.value })} rows={2} className={`${INP} resize-none`} /></div>
          <div><label className={LBL}>Category</label><select value={form.category || 'general'} onChange={e => setForm({ ...form, category: e.target.value })} className={SEL}><option value="general">General</option><option value="customer-service">Customer Service</option><option value="sales">Sales</option><option value="hr">HR</option><option value="healthcare">Healthcare</option><option value="finance">Finance</option><option value="it">IT</option><option value="feedback">Feedback</option></select></div>
          <div><label className={LBL}>Tags</label><TagInput tags={form.tags || []} onChange={tags => setForm({ ...form, tags })} /></div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-[11px] font-semibold text-tx-tp">Actions</label><button onClick={() => onUpdateSchema({ ...schema, actions: [...(schema.actions || []), { id: crypto.randomUUID(), label: 'New Action', type: 'submit', variant: 'secondary' }] })} className="flex items-center gap-1 text-[10px] text-tx-citron font-semibold"><Plus className="w-3 h-3" /> Add</button></div>
            <div className="space-y-2">{(schema.actions || []).map((action, i) => (<div key={action.id} className="bg-tx-s3 rounded-lg p-2.5 space-y-2 border border-tx-bsubtle"><div className="flex items-center gap-2"><input type="text" value={action.label} onChange={e => { const a = [...schema.actions]; a[i] = { ...a[i], label: e.target.value }; onUpdateSchema({ ...schema, actions: a }); }} className={`${INP} flex-1`} placeholder="Button label" /><button onClick={() => onUpdateSchema({ ...schema, actions: schema.actions.filter((_, j) => j !== i) })} className="w-6 h-6 rounded flex items-center justify-center text-tx-tt hover:text-tx-red transition-colors flex-shrink-0"><Trash2 className="w-3 h-3" /></button></div><div className="flex gap-2"><select value={action.type} onChange={e => { const a = [...schema.actions]; a[i] = { ...a[i], type: e.target.value }; onUpdateSchema({ ...schema, actions: a }); }} className={`${SEL} flex-1`}><option value="submit">Submit</option><option value="workflow">Run Workflow</option><option value="custom">Custom</option></select><select value={action.variant} onChange={e => { const a = [...schema.actions]; a[i] = { ...a[i], variant: e.target.value }; onUpdateSchema({ ...schema, actions: a }); }} className={`${SEL} w-24`}><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="danger">Danger</option></select></div>{action.type === 'workflow' && <select value={action.workflowId || ''} onChange={e => { const a = [...schema.actions]; a[i] = { ...a[i], workflowId: e.target.value }; onUpdateSchema({ ...schema, actions: a }); }} className={SEL}><option value="">Select workflow...</option>{workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}</div>))}</div>
          </div>

          {/* Approval */}
          <div className="border-t border-tx-bdefault pt-3">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-tx-ts block mb-2">Approval Workflow</label>
            <label className="flex items-center gap-2 text-xs text-tx-tp"><input type="checkbox" checked={form.settings?.requireApproval || false} onChange={e => us({ requireApproval: e.target.checked })} className="rounded accent-tx-citron" />Require approval before processing</label>
            {form.settings?.requireApproval && <div className="mt-2"><label className="text-[9px] text-tx-tt">Who can approve</label><div className="flex gap-2 mt-1">{['admin', 'supervisor', 'manager'].map(role => (<label key={role} className="flex items-center gap-1 text-[10px] text-tx-ts capitalize"><input type="checkbox" checked={(form.settings?.approvalRoles || []).includes(role)} onChange={e => { const roles = new Set(form.settings?.approvalRoles || []); e.target.checked ? roles.add(role) : roles.delete(role); us({ approvalRoles: [...roles] }); }} className="accent-tx-citron" />{role}</label>))}</div></div>}
          </div>

          {/* Notifications */}
          <div className="border-t border-tx-bdefault pt-3">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-tx-ts block mb-2">Notifications</label>
            <div><label className="text-[9px] text-tx-tt">Webhook URL (POST on submission)</label><input value={form.settings?.notificationWebhook || ''} onChange={e => us({ notificationWebhook: e.target.value || null })} className={`${INP} font-mono`} placeholder="https://..." /></div>
          </div>

          {/* Public Link */}
          <div className="border-t border-tx-bdefault pt-3">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-tx-ts block mb-2">Public Link</label>
            <label className="flex items-center gap-2 text-xs text-tx-tp"><input type="checkbox" checked={form.settings?.publicLink?.enabled || false} onChange={e => us({ publicLink: { ...form.settings?.publicLink, enabled: e.target.checked, slug: form.settings?.publicLink?.slug || schema.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '') } })} className="rounded accent-tx-citron" />Enable public form link</label>
            {form.settings?.publicLink?.enabled && <div className="mt-2 space-y-2"><div><label className="text-[9px] text-tx-tt">URL Slug</label><div className="flex items-center bg-tx-s3 border border-tx-bdefault rounded-lg overflow-hidden"><span className="px-2 text-[10px] text-tx-tt bg-tx-s2 border-r border-tx-bdefault">/f/</span><input value={form.settings.publicLink.slug || ''} onChange={e => us({ publicLink: { ...form.settings.publicLink, slug: e.target.value } })} className="flex-1 bg-transparent px-2 py-1.5 text-[12px] text-tx-tp focus:outline-none" /></div></div><label className="flex items-center gap-2 text-[10px] text-tx-ts"><input type="checkbox" checked={form.settings.publicLink.requireAuth || false} onChange={e => us({ publicLink: { ...form.settings.publicLink, requireAuth: e.target.checked } })} className="accent-tx-citron" />Require authentication</label></div>}
          </div>

          {/* Scheduling */}
          <div className="border-t border-tx-bdefault pt-3">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-tx-ts block mb-2">Scheduling</label>
            <label className="flex items-center gap-2 text-xs text-tx-tp"><input type="checkbox" checked={form.settings?.schedule?.enabled || false} onChange={e => us({ schedule: { ...form.settings?.schedule, enabled: e.target.checked } })} className="rounded accent-tx-citron" />Schedule form availability</label>
            {form.settings?.schedule?.enabled && <div className="mt-2 grid grid-cols-2 gap-2"><div><label className="text-[9px] text-tx-tt">Start date</label><input type="datetime-local" value={form.settings.schedule.startDate || ''} onChange={e => us({ schedule: { ...form.settings.schedule, startDate: e.target.value || null } })} className={INP} /></div><div><label className="text-[9px] text-tx-tt">End date</label><input type="datetime-local" value={form.settings.schedule.endDate || ''} onChange={e => us({ schedule: { ...form.settings.schedule, endDate: e.target.value || null } })} className={INP} /></div></div>}
          </div>

          {/* Calculated Fields */}
          <div className="border-t border-tx-bdefault pt-3">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-tx-ts block mb-2">Calculated Fields</label>
            {(form.settings?.calculatedFields || []).map((calc, ci) => (
              <div key={ci} className="mb-2 p-2 bg-tx-s3 rounded-lg border border-tx-bsubtle">
                <div className="grid grid-cols-2 gap-2 mb-1">
                  <input value={calc.variable} onChange={e => updateCalcField(ci, 'variable', e.target.value)} className={SM_INP} placeholder="variable_name" />
                  <select value={calc.format || 'number'} onChange={e => updateCalcField(ci, 'format', e.target.value)} className={SM_SEL}><option value="number">Number</option><option value="currency">Currency</option><option value="percent">Percent</option></select>
                </div>
                <input value={calc.formula} onChange={e => updateCalcField(ci, 'formula', e.target.value)} className="w-full bg-tx-s2 border border-tx-bdefault rounded px-1.5 py-1 text-[10px] text-tx-tp font-mono placeholder-tx-tt focus:outline-none focus:border-tx-citron/40" placeholder="e.g., FIELD(price) * FIELD(quantity)" />
                <button onClick={() => removeCalcField(ci)} className="text-[10px] text-tx-red mt-1 hover:text-tx-red/80">Remove</button>
              </div>
            ))}
            <button onClick={addCalcField} className="text-[10px] text-tx-citron hover:text-tx-citron/80 font-medium">+ Add calculated field</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── FIELD SELECTED: Edit field with conditional logic + validation ── */
  const fieldDef = FIELD_TYPES[selectedField.type];
  const hasOptions = ['select', 'multiselect', 'radio'].includes(selectedField.type);
  const hasRange = ['slider', 'number'].includes(selectedField.type);
  const isImageField = ['image', 'hero', 'avatar'].includes(selectedField.type);

  return (
    <div className="w-[320px] flex-shrink-0 border-l border-tx-bdefault bg-tx-s1 overflow-y-auto">
      <div className="px-4 py-3 border-b border-tx-bdefault flex items-center justify-between">
        <div className="flex items-center gap-2">{fieldDef && (() => { const I = fieldDef.icon; return <I className="w-4 h-4 text-tx-citron" />; })()}<h3 className="text-[12px] font-semibold text-tx-tp">{selectedField.label}</h3></div>
        <button onClick={() => onSelectField(null)} className="w-6 h-6 rounded-md hover:bg-tx-s3 flex items-center justify-center text-tx-tt hover:text-tx-tp transition-colors"><X className="w-3 h-3" /></button>
      </div>
      <div className="p-3 space-y-3">
        {/* Basic props */}
        <div><label className={LBL}>Label</label><input type="text" value={selectedField.label} onChange={e => uf('label', e.target.value)} className={INP} /></div>
        <div><label className={LBL}>Variable Name</label><input type="text" value={selectedField.variable} onChange={e => uf('variable', e.target.value.replace(/\s/g, '_'))} className={INP} placeholder="e.g. customer_name" /><p className="text-[9px] text-tx-tt mt-1">Used as {'${' + (selectedField.variable || 'variable') + '}'}  in templates</p></div>
        <div><label className={LBL}>Placeholder</label><input type="text" value={selectedField.placeholder} onChange={e => uf('placeholder', e.target.value)} className={INP} /></div>
        <div><label className={LBL}>Default Value</label><input type="text" value={selectedField.defaultValue} onChange={e => uf('defaultValue', e.target.value)} className={INP} /></div>
        <div className="flex items-center justify-between"><label className="text-[11px] font-medium text-tx-ts">Required</label><button onClick={() => uf('required', !selectedField.required)} className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${selectedField.required ? 'bg-tx-green' : 'bg-tx-s4'}`}><motion.div animate={{ x: selectedField.required ? 16 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm" /></button></div>

        {hasOptions && <div><label className={LBL}>Options</label><div className="space-y-1.5">{(selectedField.options || []).map((opt, i) => (<div key={i} className="flex items-center gap-1.5"><input type="text" value={opt} onChange={e => uo(i, e.target.value)} className={`${INP} flex-1`} /><button onClick={() => ro(i)} className="w-6 h-6 rounded flex items-center justify-center text-tx-tt hover:text-tx-red transition-colors flex-shrink-0"><X className="w-3 h-3" /></button></div>))}<button onClick={ao} className="flex items-center gap-1 text-[10px] text-tx-citron font-semibold"><Plus className="w-3 h-3" /> Add option</button></div></div>}

        {hasRange && <div className="flex gap-2"><div className="flex-1"><label className={LBL}>Min</label><input type="number" value={selectedField.props?.min ?? 0} onChange={e => ufp('min', Number(e.target.value))} className={INP} /></div><div className="flex-1"><label className={LBL}>Max</label><input type="number" value={selectedField.props?.max ?? 100} onChange={e => ufp('max', Number(e.target.value))} className={INP} /></div><div className="w-16"><label className={LBL}>Step</label><input type="number" value={selectedField.props?.step ?? 1} onChange={e => ufp('step', Number(e.target.value))} className={INP} /></div></div>}

        {selectedField.type === 'rating' && <div><label className={LBL}>Max Stars</label><input type="number" min={1} max={10} value={selectedField.props?.max ?? 5} onChange={e => ufp('max', Number(e.target.value))} className={INP} /></div>}
        {selectedField.type === 'flag' && <div><label className={LBL}>Levels (comma-separated)</label><input type="text" value={(selectedField.props?.levels || []).join(', ')} onChange={e => ufp('levels', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className={INP} /></div>}
        {selectedField.type === 'currency' && <div><label className={LBL}>Currency</label><select value={selectedField.props?.currency || 'USD'} onChange={e => ufp('currency', e.target.value)} className={SEL}><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option><option value="AUD">AUD (A$)</option></select></div>}

        {isImageField && <div><label className={LBL}>Image</label>{selectedField.props?.imageUrl && <div className="mb-2 rounded-lg overflow-hidden border border-tx-bsubtle"><img src={selectedField.props.imageUrl} alt="Preview" className="w-full h-24 object-cover" /></div>}<div className="flex gap-1.5"><input type="text" value={selectedField.props?.imageUrl || ''} onChange={e => ufp('imageUrl', e.target.value)} className={`${INP} flex-1`} placeholder="Image URL..." /><button onClick={() => setShowPexels(!showPexels)} className="px-2.5 py-1.5 rounded-lg bg-tx-s2 border border-tx-bdefault text-tx-ts hover:text-tx-citron hover:border-tx-citron/30 transition-all text-[10px] font-semibold whitespace-nowrap">Search</button></div>{showPexels && <div className="mt-2 p-2 rounded-lg bg-tx-s3 border border-tx-bdefault space-y-2"><div className="flex gap-1.5"><input type="text" value={pexelsQuery} onChange={e => setPexelsQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPexels()} className={`${INP} flex-1`} placeholder="Search images..." /><button onClick={searchPexels} disabled={pexelsLoading} className="px-2.5 py-1.5 rounded-lg bg-tx-citron/10 text-tx-citron text-[10px] font-semibold">{pexelsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Go'}</button></div>{pexelsResults.length > 0 && <div className="grid grid-cols-3 gap-1">{pexelsResults.slice(0, 9).map(photo => (<button key={photo.id} onClick={() => { ufp('imageUrl', photo.src?.medium || photo.src?.original || photo.url); setShowPexels(false); }} className="rounded overflow-hidden border border-tx-bsubtle hover:border-tx-citron/30 transition-all"><img src={photo.src?.tiny || photo.src?.medium} alt="" className="w-full h-12 object-cover" /></button>))}</div>}</div>}</div>}

        {selectedField.type === 'hero' && (<><div><label className={LBL}>Heading</label><input type="text" value={selectedField.props?.heading || ''} onChange={e => ufp('heading', e.target.value)} className={INP} /></div><div><label className={LBL}>Subheading</label><input type="text" value={selectedField.props?.subheading || ''} onChange={e => ufp('subheading', e.target.value)} className={INP} /></div></>)}
        {selectedField.type === 'textarea' && <div><label className={LBL}>Rows</label><input type="number" min={1} max={20} value={selectedField.props?.rows ?? 4} onChange={e => ufp('rows', Number(e.target.value))} className={INP} /></div>}
        {selectedField.type === 'badge' && (<><div><label className={LBL}>Variant</label><select value={selectedField.props?.variant || 'default'} onChange={e => ufp('variant', e.target.value)} className={SEL}><option value="default">Default</option><option value="outline">Outline</option><option value="solid">Solid</option></select></div><div><label className={LBL}>Color</label><select value={selectedField.props?.color || 'blue'} onChange={e => ufp('color', e.target.value)} className={SEL}><option value="blue">Blue</option><option value="green">Green</option><option value="red">Red</option><option value="amber">Amber</option><option value="purple">Purple</option></select></div></>)}

        {/* ── Visibility Rules ── */}
        <div className="border-t border-tx-bdefault pt-3">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-tx-ts block mb-2">Visibility Rules</label>
          <select value={selectedField.props?.visibility?.type || 'always'} onChange={e => ufp('visibility', { ...selectedField.props?.visibility, type: e.target.value })} className={SEL}>
            <option value="always">Always visible</option>
            <option value="conditional">Conditionally visible</option>
          </select>
          {selectedField.props?.visibility?.type === 'conditional' && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <button onClick={() => ufp('visibility', { ...selectedField.props.visibility, logic: 'and' })} className={`px-2 py-0.5 text-[10px] rounded font-medium ${selectedField.props.visibility.logic === 'and' ? 'bg-tx-citron/10 text-tx-citron border border-tx-citron/20' : 'bg-tx-s3 text-tx-tt border border-tx-bsubtle'}`}>AND</button>
                <button onClick={() => ufp('visibility', { ...selectedField.props.visibility, logic: 'or' })} className={`px-2 py-0.5 text-[10px] rounded font-medium ${selectedField.props.visibility.logic === 'or' ? 'bg-tx-citron/10 text-tx-citron border border-tx-citron/20' : 'bg-tx-s3 text-tx-tt border border-tx-bsubtle'}`}>OR</button>
              </div>
              {(selectedField.props.visibility.conditions || []).map((cond, ci) => (
                <div key={ci} className="flex gap-1 items-center">
                  <select value={cond.fieldId} onChange={e => updateCondition(ci, 'fieldId', e.target.value)} className="flex-1 bg-tx-s2 border border-tx-bdefault rounded px-1.5 py-1 text-[10px] text-tx-tp focus:outline-none focus:border-tx-citron/40">
                    <option value="">Select field...</option>
                    {otherFields.map(f => <option key={f.id} value={f.id}>{f.label} ({f.variable})</option>)}
                  </select>
                  <select value={cond.operator} onChange={e => updateCondition(ci, 'operator', e.target.value)} className="w-16 bg-tx-s2 border border-tx-bdefault rounded px-1.5 py-1 text-[10px] text-tx-tp focus:outline-none focus:border-tx-citron/40">
                    <option value="eq">=</option><option value="neq">≠</option><option value="gt">&gt;</option><option value="gte">≥</option><option value="lt">&lt;</option><option value="lte">≤</option><option value="contains">contains</option><option value="isEmpty">empty</option><option value="isNotEmpty">not empty</option>
                  </select>
                  {!['isEmpty', 'isNotEmpty'].includes(cond.operator) && <input value={cond.value || ''} onChange={e => updateCondition(ci, 'value', e.target.value)} className="flex-1 bg-tx-s2 border border-tx-bdefault rounded px-1.5 py-1 text-[10px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40" placeholder="Value" />}
                  <button onClick={() => removeCondition(ci)} className="text-tx-red hover:text-tx-red/80 text-xs px-1">×</button>
                </div>
              ))}
              <button onClick={addCondition} className="text-[10px] text-tx-citron hover:text-tx-citron/80 font-medium">+ Add condition</button>
            </div>
          )}
        </div>

        {/* ── Validation Rules ── */}
        <div className="border-t border-tx-bdefault pt-3">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-tx-ts block mb-2">Validation Rules</label>
          {/* Min/Max for numbers */}
          {['number', 'currency', 'slider', 'rating'].includes(selectedField.type) && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><label className="text-[9px] text-tx-tt">Min value</label><input type="number" value={selectedField.validation?.min ?? ''} onChange={e => ufv('min', e.target.value ? Number(e.target.value) : undefined)} className={INP} /></div>
              <div><label className="text-[9px] text-tx-tt">Max value</label><input type="number" value={selectedField.validation?.max ?? ''} onChange={e => ufv('max', e.target.value ? Number(e.target.value) : undefined)} className={INP} /></div>
            </div>
          )}
          {/* Min/Max length for text */}
          {['text', 'textarea', 'email', 'url'].includes(selectedField.type) && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><label className="text-[9px] text-tx-tt">Min length</label><input type="number" value={selectedField.validation?.minLength ?? ''} onChange={e => ufv('minLength', e.target.value ? Number(e.target.value) : undefined)} className={INP} /></div>
              <div><label className="text-[9px] text-tx-tt">Max length</label><input type="number" value={selectedField.validation?.maxLength ?? ''} onChange={e => ufv('maxLength', e.target.value ? Number(e.target.value) : undefined)} className={INP} /></div>
            </div>
          )}
          {/* Regex Pattern */}
          <div className="mb-2">
            <label className="text-[9px] text-tx-tt">Pattern (regex)</label>
            <input value={selectedField.validation?.pattern || ''} onChange={e => ufv('pattern', e.target.value || undefined)} className={`${INP} font-mono`} placeholder="e.g., ^[A-Z]{3}-\d{4}$" />
          </div>
          {selectedField.validation?.pattern && (
            <div className="mb-2">
              <label className="text-[9px] text-tx-tt">Pattern error message</label>
              <input value={selectedField.validation?.patternMessage || ''} onChange={e => ufv('patternMessage', e.target.value || undefined)} className={INP} placeholder="Invalid format" />
            </div>
          )}
          {/* Cross-field validation */}
          <div className="mt-2">
            <label className="text-[9px] text-tx-tt">Cross-field Rules</label>
            {(selectedField.validation?.customRules || []).map((rule, ri) => (
              <div key={ri} className="flex gap-1 items-center mt-1">
                <select value={rule.fieldVariable} onChange={e => updateCustomRule(ri, 'fieldVariable', e.target.value)} className="flex-1 bg-tx-s2 border border-tx-bdefault rounded px-1.5 py-1 text-[10px] text-tx-tp focus:outline-none focus:border-tx-citron/40">
                  <option value="">Compare to...</option>
                  {otherFields.map(f => <option key={f.id} value={f.variable}>{f.label}</option>)}
                </select>
                <select value={rule.operator} onChange={e => updateCustomRule(ri, 'operator', e.target.value)} className="w-14 bg-tx-s2 border border-tx-bdefault rounded px-1.5 py-1 text-[10px] text-tx-tp focus:outline-none focus:border-tx-citron/40">
                  <option value="eq">=</option><option value="neq">≠</option><option value="gt">&gt;</option><option value="lt">&lt;</option>
                </select>
                <input value={rule.message || ''} onChange={e => updateCustomRule(ri, 'message', e.target.value)} className="flex-1 bg-tx-s2 border border-tx-bdefault rounded px-1.5 py-1 text-[10px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40" placeholder="Error msg" />
                <button onClick={() => removeCustomRule(ri)} className="text-tx-red text-xs px-1">×</button>
              </div>
            ))}
            <button onClick={addCustomRule} className="text-[10px] text-tx-citron hover:text-tx-citron/80 font-medium mt-1">+ Add rule</button>
          </div>
        </div>
      </div>
    </div>
  );
}