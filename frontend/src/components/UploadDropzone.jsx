import { motion } from 'framer-motion';
import { FileAudio, UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';

const MAX_BYTES = 200 * 1024 * 1024;
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'];
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.mp4a'];

function isAllowed(file) {
  const lower = file.name.toLowerCase();
  return ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export default function UploadDropzone({ file, onFileChange, disabled }) {
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState('');
  const inputRef = useRef(null);

  const selectFile = (candidate) => {
    if (!candidate) return;
    if (!isAllowed(candidate)) {
      setLocalError('Upload an MP3, WAV, FLAC, OGG, M4A, or MP4A file.');
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setLocalError('File must be 200 MB or smaller.');
      return;
    }
    setLocalError('');
    onFileChange(candidate);
  };

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: disabled ? 1 : 1.01 }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!disabled) selectFile(event.dataTransfer.files?.[0]);
        }}
        className={`relative overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.08] p-8 shadow-glow backdrop-blur-xl transition ${
          isDragging ? 'border-teal-300 bg-teal-300/10' : ''
        } ${disabled ? 'opacity-70' : 'cursor-pointer'}`}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.flac,.ogg,.m4a,.mp4a,audio/*"
          className="hidden"
          disabled={disabled}
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.16),transparent_34%)]" />
        <div className="relative flex flex-col items-center gap-5 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-teal-300/15 text-teal-200 ring-1 ring-teal-200/30">
            <UploadCloud size={34} />
          </div>
          <div>
            <p className="text-2xl font-semibold text-white">Drop your song here</p>
            <p className="mt-2 text-sm text-slate-300">MP3, WAV, FLAC, OGG, M4A, MP4A up to 200 MB</p>
          </div>
          <button className="rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:bg-teal-100">
            Choose audio
          </button>
        </div>
      </motion.div>

      {file && (
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <FileAudio className="h-5 w-5 shrink-0 text-teal-200" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
            onClick={() => onFileChange(null)}
            disabled={disabled}
            title="Remove file"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {localError && <p className="text-sm text-rose-300">{localError}</p>}
    </div>
  );
}
