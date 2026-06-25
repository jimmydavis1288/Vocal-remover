import { useEffect, useRef, useState } from 'react';

export default function Waveform({ src, currentTime, duration, onSeek }) {
  const canvasRef = useRef(null);
  const [peaks, setPeaks] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(src);
        const buffer = await response.arrayBuffer();
        const context = new AudioContext();
        const decoded = await context.decodeAudioData(buffer);
        const channel = decoded.getChannelData(0);
        const samples = 96;
        const block = Math.floor(channel.length / samples);
        const nextPeaks = Array.from({ length: samples }, (_, index) => {
          let sum = 0;
          const start = index * block;
          for (let i = 0; i < block; i += 1) sum += Math.abs(channel[start + i] || 0);
          return Math.min(1, sum / block / 0.45);
        });
        await context.close();
        if (!cancelled) setPeaks(nextPeaks);
      } catch {
        if (!cancelled) setPeaks(Array.from({ length: 96 }, (_, index) => 0.25 + 0.5 * Math.abs(Math.sin(index))));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * dpr;
    const height = canvas.clientHeight * dpr;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    const progress = duration ? currentTime / duration : 0;
    const barWidth = width / peaks.length;
    peaks.forEach((peak, index) => {
      const x = index * barWidth;
      const h = Math.max(4, peak * height * 0.86);
      const played = index / peaks.length <= progress;
      ctx.fillStyle = played ? '#5eead4' : 'rgba(255,255,255,0.23)';
      ctx.fillRect(x + 1, (height - h) / 2, Math.max(2, barWidth - 3), h);
    });
  }, [peaks, currentTime, duration]);

  return (
    <canvas
      ref={canvasRef}
      className="h-20 w-full cursor-pointer rounded-xl bg-white/[0.04]"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onSeek(((event.clientX - rect.left) / rect.width) * duration);
      }}
    />
  );
}

