'use client';

/**
 * FormRenderer — renders a form schema as a fillable form.
 * Supports all field types with prefill, validation, action buttons,
 * conditional visibility, and calculated fields.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, AlertCircle, Loader2, ChevronDown, Check, X, Calculator } from 'lucide-react';

const INPUT_CLS = 'w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-[13px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40';
const LABEL_CLS = 'text-[12px] font-medium text-tx-ts mb-1.5 block';

/* ── Helpers for conditional logic ────────────────────────────────── */

function findFieldById(schema: any, fieldId: string): any {
  for (const page of schema?.pages || []) {
    for (const section of page.sections || []) {
      for (const field of section.fields || []) {
        if (field.id === fieldId) return field;
      }
    }
  }
  return null;
}

function evaluateCondition(fieldValue: any, operator: string, compareValue: any): boolean {
  switch (operator) {
    case 'eq': return fieldValue == compareValue;
    case 'neq': return fieldValue != compareValue;
    case 'gt': return Number(fieldValue) > Number(compareValue);
    case 'gte': return Number(fieldValue) >= Number(compareValue);
    case 'lt': return Number(fieldValue) < Number(compareValue);
    case 'lte': return Number(fieldValue) <= Number(compareValue);
    case 'contains': return String(fieldValue || '').includes(compareValue);
    case 'isEmpty': return !fieldValue || fieldValue === '';
    case 'isNotEmpty': return !!fieldValue && fieldValue !== '';
    default: return true;
  }
}

function buildVariableToFieldMap(schema: any): Record<string, any> {
  const map = {};
  for (const page of schema?.pages || []) {
    for (const section of page.sections || []) {
      for (const field of section.fields || []) {
        if (field.variable) map[field.variable] = field.id;
      }
    }
  }
  return map;
}

export default function FormRenderer({ schema, prefilledData = {}, onSubmit, submitLabel = 'Submit', loading = false, settings = {} }: { schema: any; prefilledData?: Record<string, any>; onSubmit?: (data: Record<string, any>) => void | Promise<void>; submitLabel?: string; loading?: boolean; settings?: any }) {
  const [formData, setFormData] = useState<Record<string, any>>(() => buildInitialData(schema, prefilledData));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const pages = schema?.pages || [];
  const activePage = pages[currentPage];

  // Build a map from variable name → field id for resolving conditions
  const varToFieldMap = useMemo(() => buildVariableToFieldMap(schema), [schema]);

  // ── Conditional visibility ────────────────────────────────────────
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    const visible = new Set<string>();
    if (schema?.pages) {
      for (const page of schema.pages) {
        for (const section of page.sections || []) {
          for (const field of section.fields || []) {
            const vis = field.props?.visibility;
            if (!vis || vis.type === 'always') {
              visible.add(field.id);
            } else if (vis.type === 'conditional') {
              const results = (vis.conditions || []).map(cond => {
                // Resolve the field being referenced — could be by fieldId or variable
                let refValue;
                if (cond.fieldId) {
                  const refField = findFieldById(schema, cond.fieldId);
                  if (refField) {
                    refValue = formData[refField.id];
                  }
                } else if (cond.variable) {
                  const refFieldId = varToFieldMap[cond.variable];
                  if (refFieldId) {
                    refValue = formData[refFieldId];
                  }
                }
                return evaluateCondition(refValue, cond.operator, cond.value);
              });
              const isVisible = vis.logic === 'or'
                ? results.some(Boolean)
                : results.every(Boolean);
              if (isVisible) visible.add(field.id);
            }
          }
        }
      }
    }
    setVisibleFields(visible);
  }, [formData, schema, varToFieldMap]);

  // ── Calculated fields ─────────────────────────────────────────────
  const [calculatedValues, setCalculatedValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!settings?.calculatedFields) return;
    const computed = {};
    for (const calc of settings.calculatedFields) {
      if (!calc.formula || !calc.variable) continue;
      try {
        let expr = calc.formula;
        // Replace FIELD(x) with actual values
        expr = expr.replace(/FIELD\((\w+)\)/g, (_, varName) => {
          const fieldId = varToFieldMap[varName];
          const val = fieldId ? formData[fieldId] : undefined;
          return isNaN(val) || val === '' || val === undefined || val === null ? 0 : Number(val);
        });
        // Replace aggregate functions
        expr = expr.replace(/SUM\((\w+)\)/g, (_, varName) => {
          const items = formData[varName];
          if (!Array.isArray(items)) return 0;
          return items.reduce((s, i) => s + (Number(i) || 0), 0);
        });
        expr = expr.replace(/COUNT\((\w+)\)/g, (_, varName) => {
          const items = formData[varName];
          return Array.isArray(items) ? items.length : (items ? 1 : 0);
        });
        // Safe eval — only allow digits, whitespace, arithmetic operators, parentheses, dots
        if (/^[\d\s+\-*/().]+$/.test(expr)) {
          try { computed[calc.variable] = Function('"use strict"; return (' + expr + ')')(); }
          catch { computed[calc.variable] = null; }
        }
      } catch { computed[calc.variable] = null; }
    }
    setCalculatedValues(computed);
  }, [formData, settings, varToFieldMap]);

  // ── Form actions ──────────────────────────────────────────────────
  const setValue = useCallback((fieldId, value) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => { const { [fieldId]: _, ...rest } = prev; return rest; });
  }, []);

  function validate(): boolean {
    const errs = {};
    for (const page of pages) {
      for (const section of page.sections || []) {
        for (const field of section.fields || []) {
          // Skip validation for hidden fields
          if (!visibleFields.has(field.id)) continue;
          if (field.required && !formData[field.id] && formData[field.id] !== 0 && formData[field.id] !== false) {
            errs[field.id] = `${field.label} is required`;
          }
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>): void {
    e?.preventDefault();
    if (!validate()) return;
    const output = {};
    for (const page of pages) {
      for (const section of page.sections || []) {
        for (const field of section.fields || []) {
          if (field.variable) output[field.variable] = formData[field.id] ?? field.defaultValue ?? '';
        }
      }
    }
    // Include calculated field values
    if (settings?.calculatedFields) {
      for (const calc of settings.calculatedFields) {
        if (calc.variable && calculatedValues[calc.variable] !== undefined) {
          output[calc.variable] = calculatedValues[calc.variable];
        }
      }
    }
    setSubmitted(true);
    onSubmit?.(output);
  }

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-tx-green/10 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-tx-green" />
        </div>
        <h3 className="text-[16px] font-bold text-tx-tp mb-1">Form Submitted</h3>
        <p className="text-[12px] text-tx-tt">Thank you for your submission.</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {pages.length > 1 && (
        <div className="flex gap-1 mb-4">
          {pages.map((page, i) => (
            <button key={page.id} type="button" onClick={() => setCurrentPage(i)} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${i === currentPage ? 'bg-tx-citron/10 text-tx-citron border border-tx-citron/20' : 'text-tx-ts hover:text-tx-tp bg-tx-s2 border border-transparent'}`}>
              {page.title}
            </button>
          ))}
        </div>
      )}

      {activePage?.sections?.map((section) => (
        <div key={section.id} className="rounded-xl bg-tx-s2 border border-tx-bdefault overflow-hidden">
          {section.title && (
            <div className="px-4 py-2.5 border-b border-tx-bdefault bg-tx-s3/30">
              <h3 className="text-[13px] font-semibold text-tx-tp">{section.title}</h3>
            </div>
          )}
          <div className="p-4 space-y-4">
            {section.fields?.map((field) => {
              // Check conditional visibility
              if (!visibleFields.has(field.id)) return null;
              return (
                <FieldInput key={field.id} field={field} value={formData[field.id]} error={errors[field.id]} onChange={(v) => setValue(field.id, v)} />
              );
            })}
            {/* Calculated fields for this section */}
            {settings?.calculatedFields?.filter(calc => {
              // Show calculated fields that reference variables from this section
              const sectionVars = new Set((section.fields || []).map(f => f.variable).filter(Boolean));
              if (!sectionVars.size) return false;
              // Check if the formula references any variable from this section
              const formulaRefs = calc.formula.match(/FIELD\((\w+)\)/g) || [];
              return formulaRefs.some(ref => {
                const varName = ref.match(/FIELD\((\w+)\)/)?.[1];
                return varName && sectionVars.has(varName);
              });
            }).map(calc => (
              <CalculatedFieldDisplay key={calc.variable} calc={calc} value={calculatedValues[calc.variable]} />
            ))}
          </div>
        </div>
      ))}

      {/* Standalone calculated fields not tied to a specific section */}
      {settings?.calculatedFields?.filter(calc => {
        // Show calculated fields that don't reference any section's fields
        // (i.e. they reference fields across sections or are standalone)
        const allSectionVars = new Set();
        for (const page of pages) {
          for (const section of page.sections || []) {
            for (const field of section.fields || []) {
              if (field.variable) allSectionVars.add(field.variable);
            }
          }
        }
        const formulaRefs = calc.formula.match(/FIELD\((\w+)\)/g) || [];
        const hasSectionRef = formulaRefs.some(ref => {
          const varName = ref.match(/FIELD\((\w+)\)/)?.[1];
          return varName && allSectionVars.has(varName);
        });
        // Only show standalone if none of its refs are from any section
        // (this prevents double-rendering; section-level ones are shown in their section)
        return !hasSectionRef;
      }).map(calc => (
        <div key={calc.variable} className="rounded-xl bg-tx-s2 border border-tx-bdefault p-4">
          <CalculatedFieldDisplay calc={calc} value={calculatedValues[calc.variable]} />
        </div>
      ))}

      {/* Navigation + Actions */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-2">
          {currentPage > 0 && (
            <button type="button" onClick={() => setCurrentPage((p) => p - 1)} className="px-4 py-2 rounded-lg bg-tx-s2 border border-tx-bdefault text-tx-ts text-[12px] font-medium hover:text-tx-tp transition-colors">
              Previous
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {currentPage < pages.length - 1 ? (
            <button type="button" onClick={() => setCurrentPage((p) => p + 1)} className="px-4 py-2 rounded-lg gradient-primary text-tx-ti text-[12px] font-semibold">
              Next
            </button>
          ) : (
            (schema.actions || [{ label: submitLabel, type: 'submit', variant: 'primary' }]).map((action, i) => (
              <button key={action.id || i} type={action.type === 'submit' ? 'submit' : 'button'} onClick={action.type !== 'submit' ? handleSubmit : undefined} disabled={loading}
                className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${
                  action.variant === 'danger' ? 'bg-tx-red/10 text-tx-red border border-tx-red/20 hover:bg-tx-red/20' :
                  action.variant === 'secondary' ? 'bg-tx-s2 border border-tx-bdefault text-tx-ts hover:text-tx-tp' :
                  'gradient-primary text-tx-ti'
                } disabled:opacity-50`}
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : action.label}
              </button>
            ))
          )}
        </div>
      </div>
    </form>
  );
}

/* ── Calculated field display ─────────────────────────────────────── */
function CalculatedFieldDisplay({ calc, value }: { calc: any; value: any }) {
  const formatValue = (val, format) => {
    if (val === null || val === undefined) return '—';
    switch (format) {
      case 'currency': return `$${Number(val).toFixed(2)}`;
      case 'percent': return `${Number(val).toFixed(1)}%`;
      case 'number': return Number(val).toLocaleString();
      default: return String(val);
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-tx-citron/[0.06] border border-tx-citron/10">
      <div className="flex items-center gap-2">
        <Calculator className="w-3.5 h-3.5 text-tx-citron" />
        <label className="text-[12px] font-medium text-tx-ts">{calc.label || calc.variable}</label>
      </div>
      <span className="text-[13px] font-semibold text-tx-tp tabular-nums">
        {formatValue(value, calc.format)}
      </span>
    </div>
  );
}

/* ── Individual field renderer ── */
function FieldInput({ field, value, error, onChange }: { field: any; value: any; error?: string; onChange: (value: any) => void }) {
  const id = `field-${field.id}`;
  const required = field.required ? <span className="text-tx-red ml-0.5">*</span> : null;

  const label = <label htmlFor={id} className={LABEL_CLS}>{field.label}{required}</label>;
  const errorMsg = error ? <p className="text-[10px] text-tx-red mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p> : null;

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
      return <div>{label}<input id={id} type={field.type === 'phone' ? 'tel' : field.type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={INPUT_CLS} />{errorMsg}</div>;

    case 'number':
    case 'currency':
      return <div>{label}<input id={id} type="number" value={value || ''} onChange={(e) => onChange(Number(e.target.value))} placeholder={field.placeholder} min={field.props?.min} max={field.props?.max} className={INPUT_CLS} />{errorMsg}</div>;

    case 'textarea':
      return <div>{label}<textarea id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} rows={field.props?.rows || 4} className={`${INPUT_CLS} resize-none`} />{errorMsg}</div>;

    case 'select':
      return <div>{label}<select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS}><option value="">Select...</option>{(field.options || []).map((o, i) => <option key={i} value={typeof o === 'object' ? o.value : o}>{typeof o === 'object' ? o.label : o}</option>)}</select>{errorMsg}</div>;

    case 'multiselect':
      return <MultiSelectField id={id} field={field} value={value || []} onChange={onChange} label={label} error={errorMsg} />;

    case 'checkbox':
      return <div className="flex items-center gap-2"><input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 rounded border-tx-bdefault accent-tx-citron" /><label htmlFor={id} className="text-[13px] text-tx-tp">{field.label}{required}</label></div>;

    case 'radio':
      return <div>{label}<div className="space-y-2 mt-1">{(field.options || []).map((o, i) => (
        <label key={i} className="flex items-center gap-2 cursor-pointer"><input type="radio" name={id} value={typeof o === 'object' ? o.value : o} checked={value === (typeof o === 'object' ? o.value : o)} onChange={() => onChange(typeof o === 'object' ? o.value : o)} className="accent-tx-citron" /><span className="text-[13px] text-tx-tp">{typeof o === 'object' ? o.label : o}</span></label>
      ))}</div>{errorMsg}</div>;

    case 'slider':
      return <div>{label}<div className="flex items-center gap-3"><input type="range" min={field.props?.min || 0} max={field.props?.max || 100} step={field.props?.step || 1} value={value || 0} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-tx-citron" /><span className="text-[13px] text-tx-tp tabular-nums w-10 text-right">{value || 0}</span></div>{errorMsg}</div>;

    case 'switch':
      return <div className="flex items-center justify-between"><label className="text-[12px] font-medium text-tx-ts">{field.label}{required}</label><button type="button" onClick={() => onChange(!value)} className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-tx-green' : 'bg-tx-s4'}`}><motion.div animate={{ x: value ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm" /></button></div>;

    case 'date':
      return <div>{label}<input id={id} type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} />{errorMsg}</div>;

    case 'time':
      return <div>{label}<input id={id} type="time" value={value || ''} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} />{errorMsg}</div>;

    case 'datetime':
      return <div>{label}<input id={id} type="datetime-local" value={value || ''} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} />{errorMsg}</div>;

    case 'rating':
      return <RatingField id={id} field={field} value={value || 0} onChange={onChange} label={label} error={errorMsg} />;

    case 'flag':
      return <div>{label}<div className="flex gap-2 mt-1">{(field.props?.levels || ['low', 'medium', 'high', 'critical']).map((level) => (
        <button key={level} type="button" onClick={() => onChange(level)} className={`px-3 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all ${value === level ? 'bg-tx-citron/10 text-tx-citron border border-tx-citron/20' : 'bg-tx-s3 text-tx-ts border border-tx-bsubtle hover:border-tx-bdefault'}`}>{level}</button>
      ))}</div>{errorMsg}</div>;

    case 'avatar':
      return <div>{label}<div className="flex items-center gap-3">{field.props?.imageUrl || value ? <img src={value || field.props?.imageUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-tx-bdefault" /> : <div className="w-16 h-16 rounded-full bg-tx-s3 flex items-center justify-center text-tx-tt text-xl font-bold border-2 border-tx-bdefault">?</div>}<input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Image URL..." className={`${INPUT_CLS} flex-1`} /></div>{errorMsg}</div>;

    case 'image':
      return <div>{label}{(field.props?.imageUrl || value) ? <img src={value || field.props?.imageUrl} alt="" className="rounded-lg border border-tx-bdefault max-w-full" style={{ width: field.props?.width || '100%', height: field.props?.height || 200, objectFit: 'cover' }} /> : <div className="rounded-lg border-2 border-dashed border-tx-bsubtle bg-tx-s3 flex items-center justify-center text-tx-tt text-[12px]" style={{ height: field.props?.height || 200 }}>Image placeholder</div>}{errorMsg}</div>;

    case 'badge':
      const badgeColors = { blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20', green: 'bg-tx-green/10 text-tx-green border-tx-green/20', red: 'bg-tx-red/10 text-tx-red border-tx-red/20', amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20', purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      return <div>{label}<span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${badgeColors[field.props?.color || 'blue'] || badgeColors.blue}`}>{value || field.defaultValue || 'Badge'}</span>{errorMsg}</div>;

    case 'hero':
      return (
        <div className="relative rounded-xl overflow-hidden border border-tx-bdefault" style={{ minHeight: 120 }}>
          {field.props?.backgroundImage && <img src={field.props.backgroundImage} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="relative p-6" style={{ background: field.props?.backgroundImage ? 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%)' : 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(0,0,0,0) 100%)' }}>
            <h2 className="text-[18px] font-bold text-white">{field.props?.heading || 'Welcome'}</h2>
            {field.props?.subheading && <p className="text-[13px] text-white/70 mt-1">{field.props.subheading}</p>}
          </div>
        </div>
      );

    default:
      return <div>{label}<input id={id} type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={INPUT_CLS} />{errorMsg}</div>;
  }
}

/* ── Multi-select component ── */
function MultiSelectField({ id, field, value = [], onChange, label, error }: { id: string; field: any; value?: string[]; onChange: (value: any) => void; label: React.ReactNode; error?: React.ReactNode }) {
  const [open, setOpen] = useState<boolean>(false);
  const toggle = (opt) => {
    const optVal = typeof opt === 'object' ? opt.value : opt;
    const newVal = value.includes(optVal) ? value.filter((v) => v !== optVal) : [...value, optVal];
    onChange(newVal);
  };
  return (
    <div className="relative">
      {label}
      <button type="button" onClick={() => setOpen(!open)} className={`${INPUT_CLS} text-left flex items-center justify-between`}>
        <span className={value.length ? 'text-tx-tp' : 'text-tx-tt'}>{value.length ? value.join(', ') : 'Select options...'}</span>
        <ChevronDown className="w-4 h-4 text-tx-tt" />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-tx-s2 border border-tx-bdefault rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {(field.options || []).map((opt, i) => {
            const optVal = typeof opt === 'object' ? opt.value : opt;
            const optLabel = typeof opt === 'object' ? opt.label : opt;
            return (
              <button key={i} type="button" onClick={() => toggle(opt)} className="w-full text-left px-3 py-2 text-[12px] hover:bg-tx-s3 flex items-center gap-2 transition-colors">
                <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${value.includes(optVal) ? 'bg-tx-citron border-tx-citron' : 'border-tx-bdefault'}`}>
                  {value.includes(optVal) && <Check className="w-3 h-3 text-tx-ti" />}
                </span>
                {optLabel}
              </button>
            );
          })}
        </div>
      )}
      {error}
    </div>
  );
}

/* ── Star rating component ── */
function RatingField({ id, field, value = 0, onChange, label, error }: { id: string; field: any; value?: number; onChange: (value: any) => void; label: React.ReactNode; error?: React.ReactNode }) {
  const max = field.props?.max || 5;
  const [hovered, setHovered] = useState<number>(0);
  return (
    <div>
      {label}
      <div className="flex items-center gap-1 mt-1">
        {Array.from({ length: max }, (_, i) => (
          <button key={i} type="button" onClick={() => onChange(i + 1)} onMouseEnter={() => setHovered(i + 1)} onMouseLeave={() => setHovered(0)} className="transition-transform hover:scale-110">
            <Star className={`w-6 h-6 ${(hovered || value) > i ? 'text-amber-400 fill-amber-400' : 'text-tx-s4'}`} />
          </button>
        ))}
        <span className="ml-2 text-[13px] text-tx-ts tabular-nums">{value}/{max}</span>
      </div>
      {error}
    </div>
  );
}

/* ── Helper ── */
function buildInitialData(schema: any, prefilledData: Record<string, any>): Record<string, any> {
  const data = {};
  for (const page of schema?.pages || []) {
    for (const section of page.sections || []) {
      for (const field of section.fields || []) {
        if (field.variable && prefilledData[field.variable] !== undefined) {
          data[field.id] = prefilledData[field.variable];
        } else if (field.defaultValue !== undefined && field.defaultValue !== '') {
          data[field.id] = field.defaultValue;
        } else if (field.type === 'checkbox' || field.type === 'switch') {
          data[field.id] = false;
        } else if (field.type === 'multiselect') {
          data[field.id] = [];
        }
      }
    }
  }
  return data;
}
