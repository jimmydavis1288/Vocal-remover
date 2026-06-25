import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Clock, Music2, Sparkles, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, API_BASE_URL, friendlyApiError } from '../api/client.js';
import AudioResultCard from '../components/AudioResultCard.jsx';
import ProgressPanel from '../components/ProgressPanel.jsx';
import UploadDropzone from '../components/UploadDropzone.jsx';
import { useJobPoll } from '../hooks/useJobPoll.js';

function formatDuration(seconds) {
  if (!seconds) return 'Unknown';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function LandingPage() {
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState('');
  const [uploadInfo, setUploadInfo] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { job, pollError } = useJobPoll(jobId, Boolean(jobId));

  const displayedJob = job || uploadInfo;
  const isComplete = job?.state === 'complete';
  const isWorking = busy || ['queued', 'processing'].includes(job?.state);

  const stats = useMemo(
    () => [
      { label: 'Song length', value: formatDuration(displayedJob?.duration), icon: Clock },
      { label: 'File size', value: formatBytes(displayedJob?.size), icon: Music2 },
      { label: 'Engine', value: (displayedJob?.device || 'CPU').toUpperCase(), icon: Zap },
      {
        label: 'Speed',
        value: displayedJob?.processing_speed ? `${displayedJob.processing_speed}x` : 'Pending',
        icon: Sparkles,
      },
    ],
    [displayedJob],
  );

  const startSeparation = async () => {
    if (!file) {
      setError('Choose an audio file first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const { data: uploaded } = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
      });
      setUploadInfo({ ...uploaded, progress: 8, state: 'uploaded' });
      setJobId(uploaded.job_id);

      const separateForm = new FormData();
      separateForm.append('job_id', uploaded.job_id);
      await api.post('/separate', separateForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (requestError) {
      setError(friendlyApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.22),transparent_34%),radial-gradient(circle_at_82%_12%,rgba(250,204,21,0.14),transparent_32%),radial-gradient(circle_at_50%_90%,rgba(56,189,248,0.15),transparent_38%)]" />
      <div className="fixed inset-0 animated-grid opacity-40" />

      <section className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-5 py-8 md:grid-cols-[1fr_0.9fr] md:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="pt-6 md:pt-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-teal-100 backdrop-blur">
            <Sparkles size={16} />
            Demucs HTDemucs stem separation
          </div>
          <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[0.95] tracking-normal text-white sm:text-6xl lg:text-7xl">
            Separate Vocals in Seconds
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Upload a track and split it into clean vocals, drums, bass, other, and a ready-to-download instrumental mix.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                <Icon className="h-5 w-5 text-teal-200" />
                <p className="mt-3 text-xs text-slate-400">{label}</p>
                <p className="mt-1 truncate text-sm font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
          <UploadDropzone file={file} onFileChange={setFile} disabled={isWorking} />
          <button
            type="button"
            onClick={startSeparation}
            disabled={!file || isWorking}
            className="group flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-teal-300 via-cyan-300 to-amber-200 px-8 py-4 text-base font-black text-slate-950 shadow-glow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Zap size={20} />
            Separate
          </button>

          {(displayedJob || isWorking) && <ProgressPanel job={displayedJob} />}
          {(error || pollError || job?.error) && (
            <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
              {error || pollError || job?.error}
            </div>
          )}
        </motion.div>
      </section>

      <AnimatePresence>
        {isComplete && (
          <motion.section
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            className="relative mx-auto max-w-7xl px-5 pb-16 md:px-8"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-teal-200">Complete</p>
                <h2 className="mt-2 text-3xl font-bold">Your separated stems are ready</h2>
              </div>
              <a
                href={`${API_BASE_URL}/download/${job.job_id}/zip`}
                download="stems.zip"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-100"
              >
                <Archive size={18} />
                Download ZIP
              </a>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <AudioResultCard title="Vocals" fileName="vocals.wav" url={job.outputs['vocals.wav']} />
              <AudioResultCard title="Instrumental" fileName="instrumental.wav" url={job.outputs['instrumental.wav']} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

