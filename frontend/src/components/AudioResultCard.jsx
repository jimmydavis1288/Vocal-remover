import { Download, Pause, Play, Volume2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { API_BASE_URL } from '../api/client.js';
import Waveform from './Waveform.jsx';

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function AudioResultCard({ title, fileName, url }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const fullUrl = `${API_BASE_URL}${url}`;

  const toggle = async () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      await audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.07] p-5 backdrop-blur-xl">
      <audio
        ref={audioRef}
        src={fullUrl}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-teal-200">Stem</p>
          <h3 className="mt-1 text-2xl font-semibold text-white">{title}</h3>
        </div>
        <a
          className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-950 transition hover:bg-teal-100"
          href={fullUrl}
          download={fileName}
          title={`Download ${title}`}
        >
          <Download size={18} />
        </a>
      </div>

      <div className="mt-5">
        <Waveform
          src={fullUrl}
          currentTime={currentTime}
          duration={duration}
          onSeek={(nextTime) => {
            audioRef.current.currentTime = nextTime;
            setCurrentTime(nextTime);
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          className="grid h-12 w-12 place-items-center rounded-full bg-teal-300 text-slate-950 transition hover:bg-teal-200"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <div className="min-w-[90px] text-sm text-slate-300">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        <label className="flex flex-1 items-center gap-2 text-slate-300">
          <Volume2 size={18} />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            defaultValue="1"
            className="w-full accent-teal-300"
            onChange={(event) => {
              audioRef.current.volume = Number(event.target.value);
            }}
          />
        </label>
      </div>
    </div>
  );
}

