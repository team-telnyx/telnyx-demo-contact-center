'use client';

import { useEffect, useState, useMemo, useCallback, useRef, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, Search, Filter, Play, Pause, SkipBack, Volume2, VolumeX,
  Download, Trash2, X, Clock, PhoneIncoming, PhoneOutgoing,
  ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  RotateCw, FileText, Brain, Tag as TagIcon, Loader2, ChevronDown,
  Disc, AlertTriangle, Music, Database, Cloud, CheckCircle2, XCircle,
  Sparkles,
} from 'lucide-react';
import api from '../../../lib/api';
import { useSocketEvent } from '../../../lib/socket';
import { useToast } from '../../../components/Toast';
import Waveform from '../../../components/Waveform';

const DATE_RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7 Days' },
  { value: '30days', label: '30 Days' },
  { value: 'all', label: 'All Time' },
];
const DIRECTION_OPTIONS = [
  { value: '', label: 'All Directions' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
];
const DURATION_OPTIONS = [
  { value: '', label: 'Any Duration' },
  { value: 'under1', label: '< 1 min' },
  { value: '1to5', label: '1-5 min' },
  { value: '5to15', label: '5-15 min' },
  { value: 'over15', label: '15+ min' },
];
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const LIMIT = 25;

function fmtDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' });
}
function dateRangeToParams(range) {
  const now = new Date();
  let dateFrom, dateTo;
  switch (range) {
    case 'today':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      break;
    case '7days':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();
      dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      break;
    case '30days':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).toISOString();
      dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      break;
    case 'all': return {};
    default: return {};
  }
  return { dateFrom, dateTo };
}
function durationToParams(duration) {
  switch (duration) {
    case 'under1': return { durationMin: 0, durationMax: 59 };
    case '1to5': return { durationMin: 60, durationMax: 299 };
    case '5to15': return { durationMin: 300, durationMax: 899 };
    case 'over15': return { durationMin: 900 };
    default: return {};
  }
}
function MiniWaveform({ isPlaying }) {
  const bars = useMemo(() => Array.from({ length: 20 }, () => 20 + Math.random() * 60), []);
  return (
    <div className="flex items-end gap-px h-6 w-16">
      {bars.map((h, i) => (
        <div key={i} className={`rounded-sm flex-1 min-w-[2px] transition-all duration-300 ${isPlaying ? 'bg-tx-green/60 animate-pulse' : 'bg-tx-tt/30'}`}
          style={{ height: `${h}%`, animationDelay: isPlaying ? `${i * 60}ms` : undefined }} />
      ))}
    </div>
  );
}

function LargeWaveform({ isPlaying, progress = 0, onSeek }) {
  const bars = useMemo(() => Array.from({ length: 80 }, () => 15 + Math.random() * 85), []);
  const activeIndex = Math.floor(progress * bars.length);
  const ref = useRef(null);
  function handleClick(e) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (onSeek) onSeek(Math.max(0, Math.min(1, pct)));
  }
  return (
    <div ref={ref} className="flex items-end gap-[1px] h-10 w-full cursor-pointer" onClick={handleClick}>
      {bars.map((h, i) => {
        const isActive = i <= activeIndex;
        return (
          <div key={i} className={`rounded-sm flex-1 min-w-[2px] transition-colors duration-150 ${isActive ? 'bg-tx-green' : 'bg-tx-tt/20'} ${isPlaying && i === activeIndex ? 'animate-pulse' : ''}`}
            style={{ height: `${h}%` }} />
        );
      })}
    </div>
  );
}

function DirectionIcon({ direction }) {
  if (direction === 'inbound') return <PhoneIncoming className="w-3.5 h-3.5 text-tx-blue" />;
  return <PhoneOutgoing className="w-3.5 h-3.5 text-tx-green" />;
}

// Derive a recording status from available fields. Telnyx records sometimes
// take a few seconds before the recording URL is populated; treat that as
// "processing". Anything older than ~10 minutes without a URL is "failed".
function recordingStatus(r) {
  const hasUrl = !!(r?.recordingUrl || r?._telnyx?.recording_urls?.mp3 || r?._telnyx?.recording_urls?.wav);
  if (hasUrl) return 'available';
  const started = r?.startedAt ? new Date(r.startedAt).getTime() : 0;
  const ageMin = started ? (Date.now() - started) / 60000 : 0;
  if (started && ageMin > 10) return 'failed';
  return 'processing';
}

function StatusBadge({ status }) {
  const map = {
    available: { Icon: CheckCircle2, label: 'Available', cls: 'bg-tx-green/10 text-tx-green border-tx-green/20' },
    processing: { Icon: Loader2, label: 'Processing', cls: 'bg-tx-blue/10 text-tx-blue border-tx-blue/20', spin: true },
    failed: { Icon: XCircle, label: 'Failed', cls: 'bg-tx-red/10 text-tx-red border-tx-red/20' },
  };
  const m = map[status] || map.available;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap ${m.cls}`}>
      <m.Icon className={`w-2.5 h-2.5 ${m.spin ? 'animate-spin' : ''}`} />
      {m.label}
    </span>
  );
}

// Compact inline player that expands within a table row when the user clicks
// the per-row "play inline" affordance. Lives entirely inside the row so it
// doesn't fight with the global bottom player bar.
function InlinePlayer({ recording, onOpenFull }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recording?.duration || 0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Auto-play on expand for a snappier feel.
    const el = audioRef.current;
    if (!el) return;
    el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    return () => { try { el.pause(); } catch {} };
  }, []);

  function toggle() {
    const el = audioRef.current; if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play().then(() => setPlaying(true)).catch(() => {}); }
  }
  function seek(pct) {
    const el = audioRef.current; if (!el || !duration) return;
    el.currentTime = pct * duration;
    setCurrentTime(el.currentTime);
  }

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-tx-s3/50 border-y border-tx-green/15">
      <audio ref={audioRef} src={`/api/recordings/${recording.id}/download`} preload="metadata"
        onLoadedMetadata={() => { if (audioRef.current) { setDuration(audioRef.current.duration); setLoaded(true); } }}
        onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
        onEnded={() => setPlaying(false)} />
      <button onClick={toggle} className="w-8 h-8 rounded-full bg-tx-green flex items-center justify-center text-tx-ti hover:bg-tx-green/90 transition-colors shadow shrink-0">
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <span className="text-[10px] font-mono text-tx-ts tabular-nums w-10 text-right shrink-0">{fmtTime(currentTime)}</span>
      <div className="flex-1"><LargeWaveform isPlaying={playing} progress={progress} onSeek={seek} /></div>
      <span className="text-[10px] font-mono text-tx-ts tabular-nums w-10 shrink-0">{fmtTime(duration)}</span>
      {playing && <div className="hidden md:block w-16 shrink-0"><Waveform bars={14} active={playing} className="h-6" color="violet" /></div>}
      <button onClick={onOpenFull} className="text-[10px] font-semibold uppercase tracking-wider text-tx-ts hover:text-tx-tp px-2 py-1 rounded-md hover:bg-tx-s3 transition-colors shrink-0" title="Open full player">Expand</button>
    </div>
  );
}
function RecordingPlayer({ recording, onClose }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [audioLoading, setAudioLoading] = useState(true);

  useEffect(() => { setPlaying(false); setCurrentTime(0); setDuration(0); setSpeed(1); setAudioLoading(true); }, [recording?.id]);
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = muted ? 0 : volume; }, [volume, muted]);

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play().catch(() => {}); }
    setPlaying(!playing);
  }
  function handleSeek(pct) {
    if (!audioRef.current || !duration) return;
    const newTime = pct * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }
  function handleRestart() {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
  }
  function handleDownload() {
    const a = document.createElement('a');
    a.href = `/api/recordings/${recording.id}/download`;
    a.download = `recording-${recording.id}.mp3`;
    a.click();
  }

  const progress = duration > 0 ? currentTime / duration : 0;
  const displayFrom = recording.contact?.name || recording.from || 'Unknown';
  const displayTo = recording.to || 'Unknown';

  return (
    <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-tx-s1/98 backdrop-blur-xl border-t border-tx-bdefault shadow-2xl">
      <audio ref={audioRef} src={`/api/recordings/${recording.id}/download`}
        onLoadedMetadata={() => { if (audioRef.current) { setDuration(audioRef.current.duration); setAudioLoading(false); } }}
        onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
        onEnded={() => setPlaying(false)} preload="metadata" />
      <div className="max-w-[1440px] mx-auto px-4 lg:px-6">
        <div className="relative h-1 bg-tx-s3 cursor-pointer" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); handleSeek((e.clientX - rect.left) / rect.width); }}>
          <div className="absolute left-0 top-0 h-full bg-tx-green transition-all duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex items-center gap-4 py-3">
          <div className="flex items-center gap-3 min-w-[200px] max-w-[280px]">
            <div className="w-10 h-10 rounded-lg bg-tx-green/10 border border-tx-green/20 flex items-center justify-center flex-shrink-0">
              <Disc className={`w-5 h-5 text-tx-green ${playing ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-tx-tp truncate">{recording.direction === 'inbound' ? `${displayFrom} → Us` : `Us → ${displayTo}`}</p>
              <p className="text-[10px] text-tx-ts truncate">{recording.queueName || 'Direct'} · {fmtDuration(recording.duration)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRestart} className="p-1.5 text-tx-ts hover:text-tx-tp transition-colors"><SkipBack className="w-4 h-4" /></button>
            <button onClick={togglePlay} disabled={audioLoading}
              className="w-10 h-10 rounded-full bg-tx-green flex items-center justify-center text-tx-ti hover:bg-tx-green/90 transition-colors shadow-lg disabled:opacity-50">
              {audioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <div className="w-20 text-center"><span className="text-[11px] font-mono text-tx-ts tabular-nums">{fmtTime(currentTime)} / {fmtTime(duration)}</span></div>
          </div>
          <div className="flex-1 hidden lg:block"><LargeWaveform isPlaying={playing} progress={progress} onSeek={handleSeek} /></div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5">
              <button onClick={() => setMuted(!muted)} className="p-1 text-tx-ts hover:text-tx-tp transition-colors">
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
                className="w-16 h-1 accent-tx-green bg-tx-s3 rounded-full cursor-pointer" />
            </div>
            <div className="relative">
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
                className="appearance-none px-2 py-1 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-[10px] font-bold cursor-pointer pr-5 hover:border-tx-bdefault transition-colors">
                {SPEED_OPTIONS.map((s) => <option key={s} value={s}>{s}x</option>)}
              </select>
              <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-tx-tt pointer-events-none" />
            </div>
            <button onClick={handleDownload} className="p-1.5 text-tx-ts hover:text-tx-tp transition-colors" title="Download"><Download className="w-4 h-4" /></button>
            <button onClick={onClose} className="p-1.5 text-tx-ts hover:text-tx-tp transition-colors" title="Close player"><X className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
function DetailPanel({ recording, onClose, onPlay, onDelete }) {
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!recording) return;
    setDetailLoading(true);
    setConfirmDelete(false);
    api.get(`/recordings/${recording.id}`).then((d) => setDetail(d)).catch(() => setDetail(recording)).finally(() => setDetailLoading(false));
  }, [recording?.id]);

  if (!recording) return null;
  const data = detail || recording;
  const transcript = data.transcript;
  const caseNote = data.caseNote;

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try { await api.delete(`/recordings/${data.id}`); onDelete(data.id); onClose(); } catch (err: any) { console.error('Failed to delete recording', err); }
  }
  function handleDownload() {
    const a = document.createElement('a'); a.href = `/api/recordings/${data.id}/download`; a.download = `recording-${data.id}.mp3`; a.click();
  }
  const displayFrom = data.contact?.name || data.from || 'Unknown';
  const displayTo = data.to || 'Unknown';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-tx-s1 border-l border-tx-bdefault shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-tx-s1 backdrop-blur-md border-b border-tx-bdefault px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2"><Mic className="w-4 h-4 text-tx-green" /><h2 className="text-sm font-semibold text-tx-tp">Recording Details</h2></div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        {detailLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-tx-green animate-spin" /></div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-4 cursor-pointer hover:border-tx-green/30 transition-colors" onClick={() => onPlay(data)}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-tx-green/10 border border-tx-green/20 flex items-center justify-center"><Play className="w-6 h-6 text-tx-green ml-0.5" /></div>
                <div className="flex-1"><p className="text-sm font-medium text-tx-tp">Play Recording</p><p className="text-xs text-tx-ts">{fmtDuration(data.duration)} · {data.direction === 'inbound' ? 'Inbound' : 'Outbound'}</p></div>
                <MiniWaveform isPlaying={false} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-3"><span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">From</span><p className="text-sm font-medium text-tx-tp mt-0.5 truncate">{displayFrom}</p>{data.from && data.contact?.name && <p className="text-[10px] text-tx-tt font-mono">{data.from}</p>}</div>
              <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-3"><span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">To</span><p className="text-sm font-medium text-tx-tp mt-0.5 truncate">{displayTo}</p></div>
              <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-3"><span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Direction</span><p className="text-sm font-medium text-tx-tp mt-0.5 flex items-center gap-1.5"><DirectionIcon direction={data.direction} />{data.direction === 'inbound' ? 'Inbound' : 'Outbound'}</p></div>
              <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-3"><span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Duration</span><p className="text-sm font-medium text-tx-tp mt-0.5 font-mono">{fmtDuration(data.duration)}</p></div>
              <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-3"><span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Agent</span><p className="text-sm font-medium text-tx-tp mt-0.5">{data.agentName || '—'}</p></div>
              <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-3"><span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Queue</span><p className="text-sm font-medium text-tx-tp mt-0.5">{data.queueName || '—'}</p></div>
              <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-3 col-span-2"><span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Date & Time</span><p className="text-sm font-medium text-tx-tp mt-0.5">{fmtDate(data.startedAt)}</p></div>
            </div>
            {data.disposition && (
              <div><h3 className="text-xs font-semibold text-tx-ts uppercase tracking-wider mb-2 flex items-center gap-1.5"><TagIcon className="w-3 h-3" /> Disposition</h3>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider inline-block" style={{ background: `${data.disposition.color}22`, color: data.disposition.color, border: `1px solid ${data.disposition.color}44` }}>{data.disposition.name}</span></div>
            )}
            <div>
              <h3 className="text-xs font-semibold text-tx-ts uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText className="w-3 h-3 text-tx-blue" /> Transcript</h3>
              {transcript?.fullText ? (
                <div className="bg-tx-s3 border border-tx-bdefault rounded-xl p-4 font-mono text-xs text-tx-ts max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">{transcript.fullText}</div>
              ) : transcript?.segments?.length > 0 ? (
                <div className="bg-tx-s3 border border-tx-bdefault rounded-xl p-4 max-h-48 overflow-y-auto space-y-1.5">
                  {transcript.segments.map((seg, i) => <p key={i} className="text-xs"><span className="text-tx-green font-medium">{seg.speaker || 'Speaker'}:</span>{' '}<span className="text-tx-ts">{seg.text}</span></p>)}
                </div>
              ) : <p className="text-tx-ts text-xs">No transcript available for this call.</p>}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-tx-ts uppercase tracking-wider mb-2 flex items-center gap-1.5"><Brain className="w-3 h-3 text-tx-citron" /> AI Case Notes
                <span className={`text-[9px] font-semibold uppercase tracking-wider ml-auto ${data.caseNotesStatus === 'done' ? 'text-tx-green' : data.caseNotesStatus === 'generating' ? 'text-tx-blue' : data.caseNotesStatus === 'error' ? 'text-tx-red' : 'text-tx-ts'}`}>{data.caseNotesStatus || 'pending'}</span>
              </h3>
              {caseNote ? (
                <div className="space-y-3">
                  {caseNote.summary && <div><span className="text-[10px] font-semibold text-tx-tt uppercase">Summary</span><p className="text-xs text-tx-ts leading-relaxed mt-0.5">{caseNote.summary}</p></div>}
                  {caseNote.keyPoints?.length > 0 && <div><span className="text-[10px] font-semibold text-tx-tt uppercase">Key Points</span><ul className="mt-1 space-y-0.5">{caseNote.keyPoints.map((kp, i) => <li key={i} className="text-xs text-tx-ts flex items-start gap-1.5"><span className="text-tx-green mt-0.5">&#8226;</span>{kp}</li>)}</ul></div>}
                  {caseNote.sentiment && <div className="flex items-center gap-2"><span className="text-[10px] font-semibold text-tx-tt uppercase">Sentiment</span><span className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wider ${caseNote.sentiment === 'positive' ? 'bg-tx-green/10 text-tx-green border-tx-green/20' : caseNote.sentiment === 'negative' ? 'bg-orange-400/10 text-orange-400 border-orange-400/15' : caseNote.sentiment === 'urgent' ? 'bg-tx-red/10 text-tx-red border-tx-red/20' : 'bg-tx-s2 text-tx-ts border-tx-bdefault'}`}>{caseNote.sentiment}</span></div>}
                </div>
              ) : <p className="text-tx-ts text-xs">{data.caseNotesStatus === 'generating' ? 'Generating case notes...' : data.caseNotesStatus === 'pending' ? 'Case notes pending generation.' : 'No case notes available.'}</p>}
            </div>
            <div className="pt-3 border-t border-tx-bdefault flex items-center gap-2">
              <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-tx-green/10 border border-tx-green/20 text-tx-green text-xs font-medium hover:bg-tx-green/20 transition-colors"><Download className="w-3.5 h-3.5" /> Download</button>
              <button onClick={handleDelete} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${confirmDelete ? 'bg-tx-red text-tx-ti hover:bg-tx-red/90' : 'bg-tx-red/10 border border-tx-red/20 text-tx-red hover:bg-tx-red/20'}`}>
                {confirmDelete ? <><AlertTriangle className="w-3.5 h-3.5" /> Confirm Delete</> : <><Trash2 className="w-3.5 h-3.5" /> Delete</>}
              </button>
              {confirmDelete && <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs font-medium hover:text-tx-tp transition-colors">Cancel</button>}
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}
function FilterSelect({ value, onChange, options, label }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="px-2.5 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs focus:outline-none focus:border-tx-green/50 appearance-none cursor-pointer pr-6 hover:border-tx-bdefault"
      aria-label={label}>
      {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-tx-bdefault">
          {['', '', 'From', 'To', '', 'Duration', 'Agent', 'Queue', 'Date/Time', ''].map((h, i) => (
            <th key={i} className="px-4 py-3 text-[10px] font-semibold text-tx-tt uppercase tracking-wider">{h && <div className="shimmer h-3 w-12 rounded" />}</th>
          ))}
        </tr></thead>
        <tbody>{Array.from({ length: 10 }).map((_, i) => (
          <tr key={i} className="border-b border-tx-bdefault">
            {Array.from({ length: 10 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="shimmer h-4 rounded" style={{ width: `${30 + Math.random() * 60}px` }} /></td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [nowPlaying, setNowPlaying] = useState<any>(null);
  const [detailRecording, setDetailRecording] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [agents, setAgents] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [filterDirection, setFilterDirection] = useState('');
  const [filterAgentId, setFilterAgentId] = useState('');
  const [filterQueueName, setFilterQueueName] = useState('');
  const [filterDuration, setFilterDuration] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('30days');
  const [sortColumn, setSortColumn] = useState('startedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [inlinePlayingId, setInlinePlayingId] = useState<string | null>(null);
  // 'local' = our DB; 'telnyx' = direct Telnyx /v2/recordings proxy
  const [source, setSource] = useState<'local' | 'telnyx'>('local');
  const [summaryModal, setSummaryModal] = useState<{ id: string; loading: boolean; summary: string | null; error: string | null; notFound: boolean } | null>(null);
  const { addToast } = useToast();

  // Listen for new recordings via Socket.IO
  useSocketEvent('recording:saved', useCallback((recording) => {
    setRecordings((prev) => {
      // Avoid duplicates
      if (prev.some((r) => r.id === recording.id)) return prev;
      return [recording, ...prev];
    });
    setTotal((prev) => prev + 1);
    addToast('New recording available', 'info');
  }, [addToast]));

  useEffect(() => {
    api.get('/agents').then((d) => setAgents(Array.isArray(d) ? d : [])).catch(() => {});
    api.get('/queues').then((d) => setQueues(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterDirection) c++; if (filterAgentId) c++; if (filterQueueName) c++;
    if (filterDuration) c++; if (searchQuery) c++; if (dateRange !== '30days') c++;
    return c;
  }, [filterDirection, filterAgentId, filterQueueName, filterDuration, searchQuery, dateRange]);

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (source === 'telnyx') {
        // Direct Telnyx proxy — use Telnyx's pagination + filter format
        const params = new URLSearchParams();
        params.set('page[number]', String(page));
        params.set('page[size]', String(LIMIT));
        const drParams = dateRangeToParams(dateRange);
        if (drParams.dateFrom) params.set('filter[created_at][gte]', drParams.dateFrom);
        if (drParams.dateTo)   params.set('filter[created_at][lte]', drParams.dateTo);
        const data = await api.get(`/recordings/telnyx?${params}`);
        // Telnyx envelope: { data: [...], meta: { total_results, total_pages, ... } }
        const list = Array.isArray(data?.data) ? data.data : [];
        // Normalize to a shape the table renderer can use while preserving raw
        // Telnyx field names alongside.
        const normalized = list.map((r: any) => ({
          id: r.id,
          from: r.from || null,
          to: r.to || null,
          direction: r.source === 'outbound' ? 'outbound' : (r.source === 'inbound' ? 'inbound' : (r.direction || null)),
          duration: r.duration_secs ?? null,
          agentName: null,
          queueName: null,
          recordingUrl: r.recording_urls?.mp3 || r.recording_urls?.wav || null,
          startedAt: r.created_at || null,
          endedAt: r.updated_at || null,
          // Raw Telnyx fields preserved for the detail panel
          _telnyx: r,
          _source: 'telnyx' as const,
          call_leg_id: r.call_leg_id || null,
        }));
        setRecordings(normalized);
        setTotal(data?.meta?.total_results ?? normalized.length);
        setPages(data?.meta?.total_pages ?? 1);
      } else {
        const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
        if (filterDirection) params.set('direction', filterDirection);
        if (filterAgentId) params.set('agentId', filterAgentId);
        if (filterQueueName) params.set('queueName', filterQueueName);
        if (searchQuery) params.set('search', searchQuery);
        const durParams = durationToParams(filterDuration);
        if (durParams.durationMin !== undefined) params.set('durationMin', String(durParams.durationMin));
        if (durParams.durationMax !== undefined) params.set('durationMax', String(durParams.durationMax));
        const drParams = dateRangeToParams(dateRange);
        if (drParams.dateFrom) params.set('dateFrom', drParams.dateFrom);
        if (drParams.dateTo) params.set('dateTo', drParams.dateTo);
        const data = await api.get(`/recordings?${params}`);
        setRecordings(data.recordings || []);
        setTotal(data.pagination?.total || 0);
        setPages(data.pagination?.pages || 0);
      }
    } catch (err: any) { console.error('Failed to fetch recordings', err); setError(err.message || 'Failed to load recordings'); }
    finally { setLoading(false); }
  }, [source, page, filterDirection, filterAgentId, filterQueueName, filterDuration, searchQuery, dateRange]);

  useEffect(() => { fetchRecordings(); }, [fetchRecordings]);
  useEffect(() => { setPage(1); }, [source, filterDirection, filterAgentId, filterQueueName, filterDuration, searchQuery, dateRange]);

  /* AI Summary fetch / generate */
  const openSummary = useCallback(async (recordingId: string) => {
    setSummaryModal({ id: recordingId, loading: true, summary: null, error: null, notFound: false });
    try {
      const res = await api.get(`/recordings/${recordingId}/summary`);
      setSummaryModal({ id: recordingId, loading: false, summary: res.summary || res.text || JSON.stringify(res), error: null, notFound: false });
    } catch (err: any) {
      if (err?.status === 404 || err?.data?.error?.includes('not found')) {
        setSummaryModal({ id: recordingId, loading: false, summary: null, error: null, notFound: true });
      } else {
        setSummaryModal({ id: recordingId, loading: false, summary: null, error: err?.data?.error || err?.message || 'Failed to load summary', notFound: false });
      }
    }
  }, []);

  const generateSummary = useCallback(async (recordingId: string) => {
    setSummaryModal((prev) => prev ? { ...prev, loading: true } : prev);
    try {
      const res = await api.post(`/recordings/${recordingId}/summary`);
      setSummaryModal({ id: recordingId, loading: false, summary: res.summary || res.text || JSON.stringify(res), error: null, notFound: false });
    } catch (err: any) {
      setSummaryModal((prev) => prev ? { ...prev, loading: false, error: err?.data?.error || err?.message || 'Failed to generate summary', notFound: false } : prev);
    }
  }, []);

  const sortedRecordings = useMemo(() => {
    if (!sortColumn) return recordings;
    return [...recordings].sort((a, b) => {
      let va = a[sortColumn]; let vb = b[sortColumn];
      if (sortColumn === 'agentName') { va = a.agentName || ''; vb = b.agentName || ''; }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va == null) va = ''; if (vb == null) vb = '';
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [recordings, sortColumn, sortDir]);

  function handleSort(column) {
    if (sortColumn === column) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    else { setSortColumn(column); setSortDir('asc'); }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === recordings.length && recordings.length > 0) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(recordings.map((r) => r.id))); }
  }

  function clearAllFilters() {
    setFilterDirection(''); setFilterAgentId(''); setFilterQueueName('');
    setFilterDuration(''); setSearchQuery(''); setDateRange('30days');
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} recording(s)? This removes the recording URL but keeps the call record.`)) return;
    try {
      await api.post('/recordings/bulk-delete', { ids: [...selectedIds] });
      setSelectedIds(new Set());
      fetchRecordings();
    } catch (err: any) { console.error('Bulk delete failed', err); }
  }

  function handleBulkDownload() {
    for (const id of selectedIds) {
      const a = document.createElement('a'); a.href = `/api/recordings/${id}/download`; a.download = `recording-${id}.mp3`; a.click();
    }
  }

  function handleRowDownload(id) {
    const a = document.createElement('a');
    a.href = `/api/recordings/${id}/download`;
    a.download = `recording-${id}.mp3`;
    a.click();
  }

  function handleRecordingDeleted(id) {
    setRecordings((prev) => prev.filter((r) => r.id !== id));
    setTotal((prev) => prev - 1);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  const pageNums = useMemo(() => {
    const nums = []; const maxVis = 5;
    let start = Math.max(1, page - Math.floor(maxVis / 2));
    let end = Math.min(pages, start + maxVis - 1);
    if (end - start + 1 < maxVis) start = Math.max(1, end - maxVis + 1);
    for (let i = start; i <= end; i++) nums.push(i);
    return nums;
  }, [page, pages]);

  const pageStart = total > 0 ? (page - 1) * LIMIT + 1 : 0;
  const pageEnd = Math.min(page * LIMIT, total);

  const queueNames = useMemo(() => {
    const set = new Set(recordings.map((r) => r.queueName).filter(Boolean));
    queues.forEach((q) => { if (q.name) set.add(q.name); });
    return [...set].sort();
  }, [recordings, queues]);

  return (
    <div className="p-6 space-y-4 pb-28">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-tx-red/10 border border-tx-red/20 text-tx-red text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => fetchRecordings()} className="px-3 py-1 rounded-lg bg-tx-red/10 border border-tx-red/20 text-tx-red text-xs font-medium hover:bg-tx-red/20 transition-colors">Retry</button>
          <button onClick={() => setError(null)} className="p-1 text-tx-red/60 hover:text-tx-red transition-colors"><X className="w-4 h-4" /></button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-tx-green/20 flex-shrink-0">
            <Mic className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-tx-tp tracking-tight">Recordings</h1>
              <span className="px-2 py-0.5 rounded-md bg-tx-green/10 border border-tx-green/20 text-tx-green text-[10px] font-bold tracking-wider">{total}</span>
            </div>
            <p className="text-[11px] text-tx-ts mt-0.5">Call audio archive and AI transcripts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Data source toggle: Local DB vs Telnyx API */}
          <div className="flex items-center gap-0.5 bg-tx-s3/50 rounded-lg p-0.5 border border-tx-bdefault">
            <button
              onClick={() => setSource('local')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${source === 'local' ? 'bg-tx-green/20 text-tx-green shadow-sm' : 'text-tx-ts hover:text-tx-tp'}`}
              title="Recordings stored in this app's database"
            >
              <Database className="w-3 h-3" /> Local DB
            </button>
            <button
              onClick={() => setSource('telnyx')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${source === 'telnyx' ? 'bg-tx-blue/20 text-tx-blue shadow-sm' : 'text-tx-ts hover:text-tx-tp'}`}
              title="Fetch directly from Telnyx /v2/recordings"
            >
              <Cloud className="w-3 h-3" /> Telnyx API
            </button>
          </div>
          <div className="flex items-center gap-0.5 bg-tx-s3/50 rounded-lg p-0.5 border border-tx-bdefault">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setDateRange(opt.value)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${dateRange === opt.value ? 'bg-tx-green/20 text-tx-green shadow-sm' : 'text-tx-ts hover:text-tx-tp'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={fetchRecordings} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs font-medium hover:text-tx-tp transition-colors" title="Refresh">
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap p-3 bg-tx-s3/30 border border-tx-bdefault rounded-xl">
        <Filter className="w-3.5 h-3.5 text-tx-ts" />
        <FilterSelect value={filterDirection} onChange={setFilterDirection} options={DIRECTION_OPTIONS} label="Direction" />
        <FilterSelect value={filterAgentId} onChange={setFilterAgentId}
          options={[{ value: '', label: 'All Agents' }, ...agents.map((a) => ({ value: a.id, label: a.user?.displayName || a.extension || a.id.slice(0, 8) }))]} label="Agent" />
        <FilterSelect value={filterQueueName} onChange={setFilterQueueName}
          options={[{ value: '', label: 'All Queues' }, ...queueNames.map((q) => ({ value: q, label: q }))]} label="Queue" />
        <FilterSelect value={filterDuration} onChange={setFilterDuration} options={DURATION_OPTIONS} label="Duration" />
        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tx-tt" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search phone or name..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs placeholder:text-tx-tt focus:outline-none focus:border-tx-green/50" />
        </div>
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="px-1.5 py-0.5 rounded-full bg-tx-citron/15 border border-tx-citron/25 text-tx-citron text-[10px] font-bold">{activeFilterCount}</span>
            <button onClick={clearAllFilters} className="text-[10px] text-tx-citron hover:text-tx-citron/80 font-medium underline underline-offset-2">Clear all</button>
          </div>
        )}
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-2.5 bg-tx-blue/5 border border-tx-blue/15 rounded-xl text-xs">
          <span className="text-tx-ts"><span className="font-semibold text-tx-tp">{selectedIds.size}</span> selected</span>
          <button onClick={handleBulkDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-green/10 border border-tx-green/20 text-tx-green text-xs font-medium hover:bg-tx-green/20 transition-colors"><Download className="w-3 h-3" /> Download</button>
          <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-red/10 border border-tx-red/20 text-tx-red text-xs font-medium hover:bg-tx-red/20 transition-colors"><Trash2 className="w-3 h-3" /> Delete</button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-tx-ts hover:text-tx-tp transition-colors">Deselect all</button>
        </motion.div>
      )}

      {/* Table */}
      {loading ? <SkeletonTable /> : recordings.length === 0 ? (
        <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-16 text-center">
          <Music className="w-12 h-12 text-tx-tt mx-auto mb-4" />
          {activeFilterCount > 0 ? (
            <>
              <p className="text-tx-ts font-medium text-lg">No recordings match your filters</p>
              <p className="text-tx-tt text-sm mt-1">Try widening the date range or clearing a filter.</p>
              <button onClick={clearAllFilters} className="mt-4 px-4 py-2 rounded-lg bg-tx-green/10 border border-tx-green/20 text-tx-green text-xs font-medium hover:bg-tx-green/20 transition-colors">Clear All Filters</button>
            </>
          ) : (
            <>
              <p className="text-tx-ts font-medium text-lg">No recordings yet</p>
              <p className="text-tx-tt text-sm mt-1">Call recordings will appear here when calls with recording enabled are completed.</p>
              <p className="text-tx-tt text-[11px] mt-3">Tip: enable recording on a queue or trunk in <span className="font-mono text-tx-ts">Settings → Telephony</span>.</p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-tx-s1 backdrop-blur-sm">
                <tr className="border-b border-tx-bdefault">
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={selectedIds.size === recordings.length && recordings.length > 0} onChange={toggleSelectAll}
                      className="rounded border-tx-bdefault bg-tx-s3 text-tx-green focus:ring-tx-green/30 focus:ring-offset-0" />
                  </th>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-4 py-3 text-[10px] font-bold text-tx-tt uppercase tracking-widest cursor-pointer select-none hover:text-tx-tp transition-colors" onClick={() => handleSort('from')}>From {sortColumn === 'from' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-tx-green inline" /> : <ArrowDown className="w-3 h-3 text-tx-green inline" />)}</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-tx-tt uppercase tracking-widest cursor-pointer select-none hover:text-tx-tp transition-colors" onClick={() => handleSort('to')}>To {sortColumn === 'to' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-tx-green inline" /> : <ArrowDown className="w-3 h-3 text-tx-green inline" />)}</th>
                  <th className="px-4 py-3 w-20"></th>
                  <th className="px-4 py-3 text-[10px] font-bold text-tx-tt uppercase tracking-widest cursor-pointer select-none hover:text-tx-tp transition-colors" onClick={() => handleSort('duration')}>Duration {sortColumn === 'duration' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-tx-green inline" /> : <ArrowDown className="w-3 h-3 text-tx-green inline" />)}</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-tx-tt uppercase tracking-widest cursor-pointer select-none hover:text-tx-tp transition-colors" onClick={() => handleSort('agentName')}>Agent {sortColumn === 'agentName' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-tx-green inline" /> : <ArrowDown className="w-3 h-3 text-tx-green inline" />)}</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-tx-tt uppercase tracking-widest cursor-pointer select-none hover:text-tx-tp transition-colors" onClick={() => handleSort('queueName')}>Queue {sortColumn === 'queueName' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-tx-green inline" /> : <ArrowDown className="w-3 h-3 text-tx-green inline" />)}</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-tx-tt uppercase tracking-widest cursor-pointer select-none hover:text-tx-tp transition-colors" onClick={() => handleSort('startedAt')}>Date/Time {sortColumn === 'startedAt' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-tx-green inline" /> : <ArrowDown className="w-3 h-3 text-tx-green inline" />)}</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-tx-tt uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {sortedRecordings.map((r, i) => {
                  const isPlaying = nowPlaying?.id === r.id;
                  const isInline = inlinePlayingId === r.id;
                  const displayFrom = r.contact?.name || r.from || '—';
                  const status = recordingStatus(r);
                  const canPlay = status === 'available';
                  return (
                    <Fragment key={r.id}>
                    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                      className={`border-b border-tx-bdefault hover:bg-tx-s3 transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-tx-s3/40' : ''} ${isInline ? 'bg-tx-green/5' : ''}`}
                      onClick={() => setDetailRecording(r)}>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
                          className="rounded border-tx-bdefault bg-tx-s3 text-tx-green focus:ring-tx-green/30 focus:ring-offset-0" />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => {
                        e.stopPropagation();
                        if (!canPlay) return;
                        setInlinePlayingId((cur) => (cur === r.id ? null : r.id));
                      }}>
                        <button disabled={!canPlay}
                          title={canPlay ? (isInline ? 'Stop inline preview' : 'Play inline') : `Recording ${status}`}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${!canPlay ? 'bg-tx-s3 text-tx-tt cursor-not-allowed' : isInline ? 'bg-tx-green text-tx-ti shadow-lg' : 'bg-tx-green/10 text-tx-green hover:bg-tx-green/20'}`}>
                          {isInline ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-tx-ts">
                        <div className="flex flex-col"><span className="font-medium text-tx-tp text-xs">{displayFrom}</span><span className="text-[10px] text-tx-tt flex items-center gap-1 font-mono"><DirectionIcon direction={r.direction} />{r.from || '—'}</span></div>
                      </td>
                      <td className="px-4 py-3 text-tx-ts text-xs font-mono">{r.to || '—'}</td>
                      <td className="px-4 py-3"><MiniWaveform isPlaying={isPlaying || isInline} /></td>
                      <td className="px-4 py-3 text-tx-ts font-mono text-xs tabular-nums">{fmtDuration(r.duration)}</td>
                      <td className="px-4 py-3 text-tx-ts text-xs">{r.agentName || '—'}</td>
                      <td className="px-4 py-3 text-tx-ts text-xs">{r.queueName || '—'}</td>
                      <td className="px-4 py-3 text-tx-ts text-xs whitespace-nowrap">{fmtDate(r.startedAt)}</td>
                      <td className="px-4 py-3"><StatusBadge status={status} /></td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5 justify-end">
                          {/* AI Summary button — only for local recordings with transcript */}
                          {source === 'local' && (r.transcript || r.hasTranscript) && (
                            <button onClick={() => openSummary(r.id)}
                              className="p-1.5 rounded-md text-tx-tt hover:text-tx-citron hover:bg-tx-citron/10 transition-colors"
                              title="AI Summary">
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => canPlay && setNowPlaying(r)} disabled={!canPlay}
                            className="p-1.5 rounded-md text-tx-tt hover:text-tx-green hover:bg-tx-green/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-tx-tt"
                            title="Open in full player">
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => canPlay && handleRowDownload(r.id)} disabled={!canPlay}
                            className="p-1.5 rounded-md text-tx-tt hover:text-tx-blue hover:bg-tx-blue/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-tx-tt"
                            title="Download recording">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDetailRecording(r)} className="p-1.5 rounded-md text-tx-tt hover:text-tx-tp hover:bg-tx-s3 transition-colors" title="View details">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                    {isInline && canPlay && (
                      <tr className="border-b border-tx-bdefault">
                        <td colSpan={11} className="p-0">
                          <InlinePlayer recording={r} onOpenFull={() => { setInlinePlayingId(null); setNowPlaying(r); }} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className="text-xs text-tx-ts">Showing <span className="font-medium text-tx-tp">{pageStart}</span>-<span className="font-medium text-tx-tp">{pageEnd}</span> of <span className="font-medium text-tx-tp">{total}</span></span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs font-medium disabled:opacity-30 hover:text-tx-tp transition-colors">
              <ChevronLeft className="w-3 h-3" /> Prev
            </button>
            {pageNums.map((n) => (
              <button key={n} onClick={() => setPage(n)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${n === page ? 'bg-tx-green/20 text-tx-green border border-tx-green/30' : 'text-tx-ts hover:bg-tx-s3 border border-transparent'}`}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs font-medium disabled:opacity-30 hover:text-tx-tp transition-colors">
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      <AnimatePresence>
        {detailRecording && <DetailPanel recording={detailRecording} onClose={() => setDetailRecording(null)} onPlay={setNowPlaying} onDelete={handleRecordingDeleted} />}
      </AnimatePresence>

      {/* Player Bar */}
      <AnimatePresence>
        {nowPlaying && <RecordingPlayer recording={nowPlaying} onClose={() => setNowPlaying(null)} />}
      </AnimatePresence>

      {/* AI Summary Modal */}
      <AnimatePresence>
        {summaryModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setSummaryModal(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-tx-s1 border border-tx-bdefault rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-tx-bdefault">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-tx-citron" />
                    <h2 className="text-sm font-semibold text-tx-tp">AI Call Summary</h2>
                  </div>
                  <button onClick={() => setSummaryModal(null)} className="p-1.5 rounded-lg text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-5">
                  {summaryModal.loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-tx-citron animate-spin" />
                      <span className="ml-3 text-sm text-tx-ts">Loading summary…</span>
                    </div>
                  ) : summaryModal.error ? (
                    <div className="p-4 rounded-xl bg-tx-red/10 border border-tx-red/20 text-tx-red text-sm">
                      {summaryModal.error}
                    </div>
                  ) : summaryModal.notFound ? (
                    <div className="text-center py-8">
                      <Brain className="w-8 h-8 text-tx-tt mx-auto mb-3" />
                      <p className="text-sm text-tx-ts mb-4">No summary available for this recording.</p>
                      <button
                        onClick={() => generateSummary(summaryModal.id)}
                        className="px-4 py-2 rounded-xl bg-tx-citron/15 border border-tx-citron/30 text-tx-citron text-sm font-semibold hover:bg-tx-citron/25 transition-colors flex items-center gap-2 mx-auto"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Generate Summary
                      </button>
                    </div>
                  ) : (
                    <div className="prose prose-sm text-tx-tp max-w-none">
                      <p className="text-sm text-tx-tp leading-relaxed whitespace-pre-wrap">{summaryModal.summary}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
