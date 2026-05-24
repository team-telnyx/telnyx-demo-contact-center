'use client';

import { motion } from 'framer-motion';
import {
  X, CheckCircle2, AlertTriangle, Info, Volume2, Play, Trash2,
} from 'lucide-react';
import { NODE_DEFS, isNodeValid } from './constants';

const inp = 'w-full bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-tx-green/40 focus:ring-1 focus:ring-tx-green/20 transition';
const lbl = 'block text-xs font-medium text-tx-ts mb-1.5';
const sec = 'text-[10px] font-bold text-tx-ts uppercase tracking-widest mb-3';
const hnt = 'text-[10px] text-tx-ts mt-1';

export default function PropPanel({ node, onUpdate, onDelete, onClose }: { node: any; onUpdate: (key: string, value: any) => void; onDelete: () => void; onClose: () => void }) {
  if (!node) return null;
  const def: any = NODE_DEFS[node.data.type] || {};
  const Icon = def.icon;
  const valid = isNodeValid(node.data);

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="w-80 bg-tx-s1/95 backdrop-blur-xl border-l border-tx-bdefault/50 overflow-y-auto flex-shrink-0"
    >
      {/* Header */}
      <div className="sticky top-0 bg-tx-s1/95 backdrop-blur-xl border-b border-tx-bdefault/50 p-4 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${def.bg || ''} flex items-center justify-center text-tx-tp shadow-lg`}>
              {Icon && <Icon className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-sm text-tx-tp">{def.label || node.data.type}</h3>
              <p className="text-[10px] text-tx-ts">{def.desc}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-tx-s3 hover:bg-tx-s3 flex items-center justify-center text-tx-ts hover:text-tx-tp transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-[10px] font-medium flex items-center gap-1.5 ${
          valid ? 'bg-tx-green/10 text-tx-green border border-tx-green/15' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/15'
        }`}>
          {valid ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {valid ? 'Configuration valid' : 'Missing required fields'}
        </div>
      </div>

      <div className="p-4 space-y-5">

        {/* ── Speak ── */}
        {node.data.type === 'speak' && (
          <>
            <div>
              <p className={sec}>Message</p>
              <label className={lbl}>Text to speak <span className="text-tx-red">*</span></label>
              <textarea
                value={node.data.text || ''}
                onChange={(e) => onUpdate('text', e.target.value)}
                className={`${inp} h-28 resize-none`}
                placeholder='e.g. "Thanks for calling Acme. Press 1 for sales, 2 for support."'
              />
              <p className={hnt}>Spoken via Telnyx TTS when the call reaches this step.</p>
            </div>
            {node.data.text && (
              <div className="bg-tx-blue/5 border border-tx-blue/10 rounded-xl p-3">
                <p className="text-[10px] font-medium text-tx-blue mb-1 flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> Preview
                </p>
                <p className="text-xs text-tx-ts italic">&ldquo;{node.data.text}&rdquo;</p>
              </div>
            )}
            <div>
              <p className={sec}>Voice Settings</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Voice</label>
                  <select value={node.data.voice || 'female'} onChange={(e) => onUpdate('voice', e.target.value)} className={inp}>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Language</label>
                  <input value={node.data.language || 'en-AU'} onChange={(e) => onUpdate('language', e.target.value)} className={inp} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Gather ── */}
        {node.data.type === 'gather' && (
          <>
            <div>
              <p className={sec}>Input Collection</p>
              <label className={lbl}>Valid Digits <span className="text-tx-red">*</span></label>
              <input
                value={node.data.validDigits || ''}
                onChange={(e) => onUpdate('validDigits', e.target.value)}
                placeholder="e.g. 123"
                className={inp}
              />
              <p className={hnt}>Each digit creates a separate output path on the node.</p>
            </div>
            {node.data.validDigits && (
              <div className="flex flex-wrap gap-1.5">
                {node.data.validDigits.split('').map((d) => (
                  <span key={d} className="px-2.5 py-1 rounded-lg bg-tx-citron/15 border border-tx-citron/20 text-tx-citron text-xs font-bold">{d}</span>
                ))}
                <span className="px-2.5 py-1 rounded-lg bg-tx-s3 border border-tx-bsubtle text-tx-ts text-xs">★ default</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Max Digits</label>
                <input type="number" value={node.data.maxDigits || 1} onChange={(e) => onUpdate('maxDigits', parseInt(e.target.value))} className={inp} min={1} max={20} />
              </div>
              <div>
                <label className={lbl}>Timeout (ms)</label>
                <input type="number" value={node.data.timeout || 10000} onChange={(e) => onUpdate('timeout', parseInt(e.target.value))} className={inp} />
              </div>
            </div>
            <div>
              <label className={lbl}>Prompt (optional TTS)</label>
              <input value={node.data.prompt || ''} onChange={(e) => onUpdate('prompt', e.target.value)} placeholder="Spoken before listening for digits" className={inp} />
            </div>
          </>
        )}

        {/* ── Enqueue ── */}
        {node.data.type === 'enqueue' && (
          <div>
            <p className={sec}>Routing</p>
            <label className={lbl}>Queue Name <span className="text-tx-red">*</span></label>
            <input value={node.data.queueName || ''} onChange={(e) => onUpdate('queueName', e.target.value)} placeholder="e.g. sales_queue, support_queue, billing_queue" className={inp} />
            <p className={hnt}>Caller joins this queue for the next available agent.</p>
          </div>
        )}

        {/* ── Transfer ── */}
        {node.data.type === 'transfer' && (
          <div>
            <p className={sec}>Destination</p>
            <label className={lbl}>Target <span className="text-tx-red">*</span></label>
            <input value={node.data.target || ''} onChange={(e) => onUpdate('target', e.target.value)} placeholder="e.g. +61412345678  or  sip:agent@example.com" className={inp} />
            <p className={hnt}>Call is blind-transferred to this number or SIP URI.</p>
          </div>
        )}

        {/* ── Record ── */}
        {node.data.type === 'record' && (
          <div>
            <p className={sec}>Recording</p>
            <label className={lbl}>Format</label>
            <select value={node.data.format || 'mp3'} onChange={(e) => onUpdate('format', e.target.value)} className={inp}>
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
            </select>
          </div>
        )}

        {/* ── Play Audio ── */}
        {node.data.type === 'play' && (
          <div>
            <p className={sec}>Audio</p>
            <label className={lbl}>Audio URL <span className="text-tx-red">*</span></label>
            <input value={node.data.audioUrl || ''} onChange={(e) => onUpdate('audioUrl', e.target.value)} placeholder="e.g. https://cdn.example.com/hold-music.mp3" className={inp} />
            <p className={hnt}>Direct, publicly accessible link to an MP3 or WAV file.</p>
          </div>
        )}

        {/* ── AMD ── */}
        {node.data.type === 'amd' && (
          <div>
            <p className={sec}>Detection</p>
            <label className={lbl}>Mode</label>
            <select value={node.data.detection_mode || 'detect'} onChange={(e) => onUpdate('detection_mode', e.target.value)} className={inp}>
              <option value="detect">Detect</option>
              <option value="detect_words">Detect Words</option>
              <option value="greeting_end">Greeting End</option>
            </select>
            <p className={hnt}>Machine → auto-hangup. Human → continue flow.</p>
          </div>
        )}

        {/* ── Callback ── */}
        {node.data.type === 'callback' && (
          <div>
            <p className={sec}>Callback Offer</p>
            <label className={lbl}>Message</label>
            <textarea value={node.data.message || ''} onChange={(e) => onUpdate('message', e.target.value)} className={`${inp} h-20 resize-none`} placeholder="Press 1 to receive a callback..." />
            <p className={hnt}>TTS played before offering the callback option.</p>
          </div>
        )}

        {/* ── Voicemail ── */}
        {node.data.type === 'voicemail' && (
          <div>
            <p className={sec}>Voicemail</p>
            <label className={lbl}>Prompt</label>
            <textarea value={node.data.message || ''} onChange={(e) => onUpdate('message', e.target.value)} className={`${inp} h-20 resize-none`} placeholder="Please leave a message..." />
            <p className={hnt}>After speaking, recording starts automatically.</p>
          </div>
        )}

        {/* ── Whisper ── */}
        {node.data.type === 'whisper' && (
          <div>
            <p className={sec}>Whisper</p>
            <label className={lbl}>Message <span className="text-tx-red">*</span></label>
            <textarea value={node.data.message || node.data.text || ''} onChange={(e) => onUpdate('message', e.target.value)} className={`${inp} h-20 resize-none`} placeholder="Incoming call from..." />
            <p className={hnt}>Only the agent hears this before the call bridges.</p>
          </div>
        )}

        {/* ── Answer / Hangup ── */}
        {(node.data.type === 'answer' || node.data.type === 'hangup') && (
          <div className="bg-tx-s3 border border-tx-bdefault/50 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-tx-ts mt-0.5 flex-shrink-0" />
            <p className="text-xs text-tx-ts leading-relaxed">
              {node.data.type === 'answer'
                ? 'The Answer node picks up the incoming call. No configuration needed — just connect it to the next step.'
                : 'The Hangup node ends the call. Place it at the end of any branch.'}
            </p>
          </div>
        )}

        {/* Delete */}
        <div className="border-t border-tx-bdefault/50 pt-4">
          <button
            onClick={onDelete}
            className="w-full py-2 rounded-xl bg-tx-red/10 text-tx-red border border-tx-red/15 text-xs font-medium hover:bg-tx-red/20 transition flex items-center justify-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Node
          </button>
        </div>
      </div>
    </motion.div>
  );
}
