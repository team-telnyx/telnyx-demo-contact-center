'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function WaveformPlayer({ src, onClose }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const animFrameRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [hoverX, setHoverX] = useState(null);

  // Decode audio and extract peaks
  useEffect(() => {
    if (!src) return;
    setLoading(true);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    fetch(src)
      .then((r) => r.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        const raw = decoded.getChannelData(0);
        const numBars = 400;
        const blockSize = Math.floor(raw.length / numBars);
        const p = [];
        for (let i = 0; i < numBars; i++) {
          let max = 0;
          for (let j = 0; j < blockSize; j++) {
            const abs = Math.abs(raw[i * blockSize + j]);
            if (abs > max) max = abs;
          }
          p.push(max);
        }
        const peak = Math.max(...p) || 1;
        setPeaks(p.map((v) => v / peak));
        setLoading(false);
        ctx.close();
      })
      .catch(() => {
        setPeaks(Array(200).fill(0.05).map(() => 0.05 + Math.random() * 0.3));
        setLoading(false);
        ctx.close();
      });
  }, [src]);

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const barW = 3;
    const gap = 1;
    const totalBarW = barW + gap;
    const numBars = Math.min(peaks.length, Math.floor(w / totalBarW));
    const centerY = h / 2;
    const progress = duration > 0 ? currentTime / duration : 0;
    const hoverProgress = hoverX !== null ? hoverX / w : null;

    // Gradient for played portion
    const playedGrad = ctx.createLinearGradient(0, 0, 0, h);
    playedGrad.addColorStop(0, '#00E896');
    playedGrad.addColorStop(0.5, '#00a37a');
    playedGrad.addColorStop(1, '#00E896');

    // Gradient for unplayed
    const unplayedGrad = ctx.createLinearGradient(0, 0, 0, h);
    unplayedGrad.addColorStop(0, 'rgba(156, 163, 175, 0.3)');
    unplayedGrad.addColorStop(0.5, 'rgba(156, 163, 175, 0.5)');
    unplayedGrad.addColorStop(1, 'rgba(156, 163, 175, 0.3)');

    // Hover gradient
    const hoverGrad = ctx.createLinearGradient(0, 0, 0, h);
    hoverGrad.addColorStop(0, 'rgba(0, 232, 150, 0.5)');
    hoverGrad.addColorStop(0.5, 'rgba(0, 163, 122, 0.6)');
    hoverGrad.addColorStop(1, 'rgba(0, 232, 150, 0.5)');

    for (let i = 0; i < numBars; i++) {
      const peak = peaks[i] || 0;
      const x = i * totalBarW;
      const barH = Math.max(3, peak * (h * 0.95));
      const barProgress = i / numBars;

      if (barProgress <= progress) {
        ctx.fillStyle = playedGrad;
      } else if (hoverProgress !== null && barProgress <= hoverProgress) {
        ctx.fillStyle = hoverGrad;
      } else {
        ctx.fillStyle = unplayedGrad;
      }

      // Top half (mirrored)
      ctx.beginPath();
      ctx.roundRect(x, centerY - barH - 1, barW, barH, 1);
      ctx.fill();

      // Bottom half (mirrored, slightly shorter)
      const bottomH = barH * 0.6;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.roundRect(x, centerY + 1, barW, bottomH, 1);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Center line
    ctx.fillStyle = 'rgba(156, 163, 175, 0.15)';
    ctx.fillRect(0, centerY - 0.5, w, 1);

    // Playhead
    if (progress > 0) {
      const px = progress * numBars * totalBarW;
      ctx.fillStyle = '#00E896';
      ctx.shadowColor = '#00E896';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(px - 1, 2, 2, h - 4, 1);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [peaks, currentTime, duration, hoverX]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleCanvasClick = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    audio.currentTime = (x / rect.width) * duration;
    setCurrentTime(audio.currentTime);
  };

  const handleCanvasHover = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    setHoverX(e.clientX - rect.left);
  };

  const handleRateChange = () => {
    const rates = [1, 1.25, 1.5, 2, 0.5, 0.75];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const handleVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white px-4 py-4 dark:from-gray-800 dark:to-gray-900">
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        preload="auto"
      />

      {/* Waveform */}
      <div className="relative mb-4" ref={containerRef}>
        {loading ? (
          <div className="flex h-40 items-center justify-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-telnyx-green border-t-transparent" />
            <span className="text-xs text-gray-400">Loading waveform...</span>
          </div>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasHover}
              onMouseLeave={() => setHoverX(null)}
              className="h-40 w-full cursor-pointer rounded-xl"
            />
            {/* Hover time tooltip */}
            {hoverX !== null && duration > 0 && (
              <div
                className="pointer-events-none absolute -top-7 rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-mono text-white shadow"
                style={{ left: Math.min(Math.max(hoverX - 16, 0), (containerRef.current?.clientWidth || 200) - 40) }}
              >
                {formatTime((hoverX / (containerRef.current?.clientWidth || 1)) * duration)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Play/Pause */}
        <button
          onClick={handlePlayPause}
          disabled={loading}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-telnyx-green text-white shadow-md shadow-telnyx-green/30 transition-all hover:scale-105 hover:bg-telnyx-green/90 active:scale-95 disabled:opacity-40"
        >
          {isPlaying ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="h-4 w-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Time */}
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{formatTime(currentTime)}</span>
          <span className="font-mono text-[10px] text-gray-400">/ {formatTime(duration)}</span>
        </div>

        {/* Speed pill */}
        <button
          onClick={handleRateChange}
          className="rounded-full bg-gray-200 px-2.5 py-1 text-[10px] font-bold text-gray-600 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          {playbackRate}x
        </button>

        {/* Volume */}
        <div className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6.253v11.494m0 0A5.978 5.978 0 018.464 15.536M12 17.747A5.978 5.978 0 0115.536 15.536M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolume}
            className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-gray-200 accent-telnyx-green dark:bg-gray-700"
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Download */}
        <a
          href={src}
          download
          className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </a>

        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
