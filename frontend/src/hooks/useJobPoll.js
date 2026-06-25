import { useEffect, useState } from 'react';
import { api, friendlyApiError } from '../api/client.js';

export function useJobPoll(jobId, enabled) {
  const [job, setJob] = useState(null);
  const [pollError, setPollError] = useState('');

  useEffect(() => {
    if (!jobId || !enabled) return undefined;

    let active = true;
    const poll = async () => {
      try {
        const { data } = await api.get(`/status/${jobId}`);
        if (!active) return;
        setJob(data);
        setPollError('');
      } catch (error) {
        if (active) setPollError(friendlyApiError(error));
      }
    };

    poll();
    const timer = window.setInterval(poll, 1500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [jobId, enabled]);

  return { job, pollError };
}

