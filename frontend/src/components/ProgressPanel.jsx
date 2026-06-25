import { motion } from 'framer-motion';
import { Cpu, Loader2, Timer } from 'lucide-react';

function estimateRemaining(job) {
  if (!job || job.progress <= 10 || job.progress >= 100) return 'Calculating';
  const elapsed = job.elapsed_seconds || 0;
  if (!elapsed) return 'Learning pace';
  const total = elapsed / (job.progress / 100);
  return `${Math.max(1, Math.round(total - elapsed))}s`;
}

export default function ProgressPanel({ job }) {
  const progress = job?.progress ?? 0;
  const complete = job?.state === 'complete';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-teal-200">AI Engine</p>
          <h2 className="mt-1 text-xl font-semibold text-white">{job?.status || 'Waiting'}</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-semibold text-slate-200">
          <Cpu size={15} />
          {(job?.device || 'cpu').toUpperCase()}
        </div>
      </div>

      <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-teal-300 via-cyan-300 to-amber-200"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.45 }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
        <span>{progress}% complete</span>
        <span className="flex items-center gap-2">
          {complete ? <Timer size={16} /> : <Loader2 size={16} className="animate-spin" />}
          ETA {complete ? 'Done' : estimateRemaining(job)}
        </span>
      </div>
    </motion.div>
  );
}

