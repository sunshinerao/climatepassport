/** A launcher-owned consumer: no global scheduler, parallel calls or blind HTTP retries. */
export function startAutomaticAuthMailConsumer({ nextReady, sendBatch, sendWindow, intervalMs = 1500, onState = () => {} }) {
  const abort = new AbortController(); let timer, wake, previous, failures = 0, waitMs = intervalMs;
  const state = value => { if (value !== previous) { previous = value; onState(value); } };
  const pause = () => new Promise(resolve => { wake = resolve; timer = setTimeout(resolve, Math.min(60000, Math.max(waitMs, intervalMs * 2 ** failures))); });
  const done = (async () => {
    while (!abort.signal.aborted) {
      waitMs = intervalMs;
      try {
        if (!await nextReady(abort.signal)) state('IDLE');
        else if (!abort.signal.aborted) {
          const gate = await sendWindow();
          if (!gate.ready) { state(gate.reason); if(gate.stopped)break; waitMs = Math.max(intervalMs, Math.min(60000, (gate.retryAt ?? Date.now()+60000)-Date.now())); }
          else if (!abort.signal.aborted) {
            state('PROCESSING');
            const ok = await sendBatch(abort.signal);
            failures = ok ? 0 : Math.min(failures + 1, 6);
            state(ok ? 'BATCH_COMPLETED_NOT_DELIVERY_PROOF' : 'WORKER_UNAVAILABLE');
          }
        }
      } catch { if (!abort.signal.aborted) { failures = Math.min(failures + 1, 6); state('WORKER_UNAVAILABLE'); } }
      // Recheck durable eligibility after every call; PROCESSING/UNKNOWN are never blindly retried.
      if (!abort.signal.aborted) await pause();
    }
    state('STOPPED');
  })();
  return { done, stop() { abort.abort(); clearTimeout(timer); wake?.(); } };
}
