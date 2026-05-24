'use client';

/**
 * FormAIGenerate — modal for AI-generated form schemas.
 * User describes what they want, AI returns a complete form schema.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, X, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import api from '../lib/api';

export default function FormAIGenerate({ onApply, onClose }: { onApply: (schema: any) => void; onClose: () => void }) {
  const [description, setDescription] = useState('');
  const [fieldNames, setFieldNames] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [generated, setGenerated] = useState<any>(null);

  async function handleGenerate() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const fields = fieldNames.trim() ? fieldNames.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const { data } = await api.post('/forms/generate', { description, fields });
      setGenerated(data.schema || data);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Failed to generate form');
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (generated) onApply(generated);
  }

  function handleCancel() {
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 pt-12"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg bg-tx-s2 border border-tx-bdefault rounded-2xl shadow-tx-lg my-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tx-bdefault">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-tx-citron/20 to-tx-green/20 border border-tx-citron/20 flex items-center justify-center">
              <Sparkles className="w-[18px] h-[18px] text-tx-citron" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-tx-tp">AI Form Generator</h2>
              <p className="text-[10px] text-tx-tt">Describe your form and AI will build it</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-tx-s3 flex items-center justify-center text-tx-tt hover:text-tx-tp transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tx-red/10 border border-tx-red/20 text-tx-red text-[12px]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!generated ? (
            <>
              <div>
                <label className="text-[11px] font-medium text-tx-ts mb-1.5 block">Describe your form</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. A customer feedback form for our support team with fields for name, email, issue category, satisfaction rating, and comments..."
                  rows={4}
                  className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-[13px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40 resize-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-tx-ts mb-1.5 block">Specific fields <span className="text-tx-tt">(optional, comma-separated)</span></label>
                <input
                  type="text"
                  value={fieldNames}
                  onChange={(e) => setFieldNames(e.target.value)}
                  placeholder="e.g. name, email, phone, issue_type, priority"
                  className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-[13px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tx-green/10 border border-tx-green/20 text-tx-green text-[12px]">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Form generated successfully! Review the preview below.</span>
              </div>
              <div className="bg-tx-s3 rounded-xl p-4 border border-tx-bdefault max-h-[300px] overflow-y-auto">
                <div className="space-y-2">
                  <p className="text-[12px] font-semibold text-tx-tp">{generated.name || 'Generated Form'}</p>
                  {generated.description && <p className="text-[11px] text-tx-tt">{generated.description}</p>}
                  {generated.pages?.map((page, pi) => (
                    <div key={pi} className="pl-2 border-l-2 border-tx-citron/20">
                      <p className="text-[11px] font-medium text-tx-citron">{page.title}</p>
                      {page.sections?.map((section, si) => (
                        <div key={si} className="pl-2 mt-1">
                          <p className="text-[10px] font-semibold text-tx-ts">{section.title}</p>
                          {section.fields?.map((field, fi) => (
                            <div key={fi} className="flex items-center gap-1.5 pl-2 py-0.5">
                              <ArrowRight className="w-2.5 h-2.5 text-tx-tt" />
                              <span className="text-[10px] text-tx-tp">{field.label}</span>
                              <span className="text-[9px] text-tx-tt">({field.type})</span>
                              {field.required && <span className="text-[9px] text-tx-red">*</span>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-tx-bdefault bg-tx-s3/30 rounded-b-2xl">
          <button onClick={handleCancel} className="px-3 py-1.5 rounded-lg text-tx-tt hover:text-tx-tp text-[12px] font-medium transition-colors">
            {generated ? 'Discard' : 'Cancel'}
          </button>
          <div className="flex items-center gap-2">
            {generated && (
              <button onClick={() => { setGenerated(null); setError(null); }} className="px-3 py-1.5 rounded-lg bg-tx-s2 border border-tx-bdefault text-tx-ts text-[12px] font-medium hover:text-tx-tp transition-colors">
                Regenerate
              </button>
            )}
            {!generated ? (
              <button onClick={handleGenerate} disabled={loading || !description.trim()} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg gradient-primary text-tx-ti text-[12px] font-semibold disabled:opacity-50 transition-all">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Generate
              </button>
            ) : (
              <button onClick={handleApply} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg gradient-primary text-tx-ti text-[12px] font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Apply
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
