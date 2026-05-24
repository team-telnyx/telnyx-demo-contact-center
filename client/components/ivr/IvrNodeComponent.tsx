'use client';

import { Handle, Position } from 'reactflow';
import { CheckCircle2, AlertTriangle, Zap, Plus } from 'lucide-react';
import { NODE_DEFS, isNodeValid, nodeInvalidReason } from './constants';

export default function IvrNodeComponent({ data, selected, id }: { data: any; selected?: boolean; id: string }) {
  const def = NODE_DEFS[data.type] || NODE_DEFS.speak;
  const Icon = def.icon;
  const valid = isNodeValid(data);
  const isEntry = data._isEntry;
  const digits = data.type === 'gather' && data.validDigits ? data.validDigits.split('') : [];
  const isSimActive = data._simActive;
  const isValidating = data._validationActive;     // set when "Validate" was pressed
  const invalidReason = nodeInvalidReason(data);

  /* ── Preview ── */
  let preview = null;
  switch (data.type) {
    case 'speak':
      preview = data.text
        ? <p className="text-xs text-tx-ts line-clamp-2"><span className="text-tx-blue/50">&ldquo;</span>{data.text.slice(0, 60)}{data.text.length > 60 ? '…' : ''}<span className="text-tx-blue/50">&rdquo;</span></p>
        : <p className="text-xs text-yellow-400/80 italic flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No message</p>;
      break;
    case 'gather':
      preview = (
        <div className="space-y-0.5">
          {data.prompt && <p className="text-xs text-tx-ts truncate">&ldquo;{data.prompt.slice(0, 35)}&rdquo;</p>}
          <span className="text-xs text-tx-citron font-mono">{data.validDigits ? `Keys: [${data.validDigits.split('').join(', ')}]` : 'No digits'}</span>
        </div>
      );
      break;
    case 'enqueue':
      preview = <p className="text-xs text-tx-citron font-medium">→ {data.queueName || <span className="text-yellow-400 italic">No queue</span>}</p>;
      break;
    case 'transfer':
      preview = <p className="text-xs text-tx-red font-medium">→ {data.target || <span className="text-yellow-400 italic">No target</span>}</p>;
      break;
    case 'record':
      preview = <p className="text-xs text-teal-400">{(data.format || 'mp3').toUpperCase()} format</p>;
      break;
    case 'play':
      preview = <p className="text-xs text-fuchsia-400 truncate">{data.audioUrl || <span className="text-yellow-400 italic">No URL</span>}</p>;
      break;
    case 'amd':
      preview = <p className="text-xs text-sky-400">Mode: {data.detection_mode || 'detect'}</p>;
      break;
    case 'callback':
      preview = <p className="text-xs text-lime-400 truncate">{data.message ? `"${data.message.slice(0, 35)}"` : 'Default prompt'}</p>;
      break;
    case 'voicemail':
      preview = <p className="text-xs text-orange-400 truncate">{data.message ? `"${data.message.slice(0, 35)}"` : 'Default prompt'}</p>;
      break;
    case 'whisper':
      preview = <p className="text-xs text-tx-green truncate">{(data.message || data.text) ? `"${(data.message || data.text).slice(0, 35)}"` : <span className="text-yellow-400 italic">No text</span>}</p>;
      break;
    case 'answer':
      preview = <p className="text-xs text-tx-green/70">Picks up automatically</p>;
      break;
    case 'hangup':
      preview = <p className="text-xs text-tx-red/70">Disconnects the call</p>;
      break;
    default:
      preview = <p className="text-xs text-tx-ts italic">No config</p>;
  }

  const showInvalidGlow = isValidating && !valid;

  return (
    <div
      className={`relative rounded-2xl transition-all duration-300 min-w-[240px] max-w-[280px] ${
        isSimActive
          ? 'ring-2 ring-green-400 scale-[1.03]'
          : showInvalidGlow
            ? 'ring-2 ring-rose-500/70 scale-[1.01] ivr-shake'
            : selected
              ? 'ring-2 ring-white/25 scale-[1.02]'
              : 'hover:ring-1 hover:ring-white/10'
      }`}
      style={{
        boxShadow: isSimActive
          ? '0 0 25px rgba(52,211,153,0.6), 0 0 50px rgba(52,211,153,0.3), 0 8px 28px rgba(0,0,0,0.4)'
          : showInvalidGlow
            ? '0 0 22px rgba(244,63,94,0.45), 0 0 50px rgba(244,63,94,0.2), 0 8px 28px rgba(0,0,0,0.4)'
            : selected
              ? `0 0 20px ${def.border}30, 0 8px 28px rgba(0,0,0,0.4)`
              : '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      {/* Entry badge */}
      {isEntry && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold uppercase tracking-widest px-3 py-0.5 rounded-full whitespace-nowrap shadow-lg">
          <Zap className="w-3 h-3" /> Start
        </div>
      )}

      {/* Input handle */}
      {data.type !== 'answer' && (
        <Handle type="target" position={Position.Top}
          className="!w-3.5 !h-3.5 !rounded-full !border-2 !border-blue-400 !bg-tx-s1 hover:!bg-blue-400 !transition-colors"
          style={{ top: -7 }}
        />
      )}

      {/* Header */}
      <div className={`bg-gradient-to-r ${def.bg} rounded-t-2xl px-4 py-2.5 flex items-start gap-2.5`}>
        <div className="w-7 h-7 rounded-lg bg-black/25 backdrop-blur-sm flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-white truncate">{def.label}</span>
            {valid
              ? <CheckCircle2 className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
              : <AlertTriangle className="w-3.5 h-3.5 text-yellow-200 animate-pulse flex-shrink-0" />
            }
          </div>
          <p className="text-[10px] text-white/80 leading-snug truncate">{def.desc}</p>
        </div>
      </div>

      {/* Body */}
      <div className="bg-tx-s3/90 rounded-b-2xl px-4 py-3 border-t border-tx-bsubtle">
        {preview}
        {showInvalidGlow && invalidReason && (
          <p className="mt-2 text-[10px] text-rose-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{invalidReason}</span>
          </p>
        )}
      </div>

      {/* Output handles */}
      {data.type === 'gather' ? (
        <div className="absolute -bottom-3 left-0 right-0 flex justify-evenly px-6">
          {digits.map((d) => (
            <div key={d} className="flex flex-col items-center group">
              <div className="relative">
                <Handle type="source" position={Position.Bottom} id={d}
                  className="!w-5 !h-5 !rounded-full !border-2 !border-amber-400 !bg-tx-s1 hover:!bg-amber-400 !transition-colors !relative !transform-none"
                />
                {/* pulsing add hint */}
                <span className="ivr-pulse-ring pointer-events-none absolute inset-0 rounded-full border-2 border-amber-400/60" />
              </div>
              <span className="text-[9px] font-bold text-amber-400/80 mt-0.5 select-none">{d}</span>
            </div>
          ))}
          <div className="flex flex-col items-center group">
            <div className="relative">
              <Handle type="source" position={Position.Bottom} id="default"
                className="!w-5 !h-5 !rounded-full !border-2 !border-tx-bdefault !bg-tx-s1 hover:!bg-tx-ts !transition-colors !relative !transform-none"
              />
              <span className="ivr-pulse-ring pointer-events-none absolute inset-0 rounded-full border-2 border-tx-bdefault/60" />
            </div>
            <span className="text-[9px] font-bold text-tx-ts mt-0.5 select-none">★ other</span>
          </div>
        </div>
      ) : data.type !== 'hangup' ? (
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: -7 }}>
          <div className="relative">
            <Handle type="source" position={Position.Bottom}
              className="!w-3.5 !h-3.5 !rounded-full !border-2 !border-emerald-400 !bg-tx-s1 hover:!bg-emerald-400 !transition-colors !relative !transform-none"
            />
            <span className="ivr-pulse-ring pointer-events-none absolute inset-0 rounded-full border-2 border-emerald-400/60" />
            <Plus className="pointer-events-none absolute inset-0 m-auto w-2.5 h-2.5 text-emerald-400 opacity-0 hover:opacity-100 transition-opacity" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
