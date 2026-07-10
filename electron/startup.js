const DEFAULT_MIN_SPLASH_MS = 1800;
const DEFAULT_STARTUP_TIMEOUT_MS = 12000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

async function runStartupTasks(tasks, options = {}) {
  const emit = options.emit || (() => {});
  const timings = {};
  const results = {};
  const critical = tasks.filter((task) => task.critical !== false);
  const nonCritical = tasks.filter((task) => task.critical === false);

  async function runTask(task) {
    const start = Date.now();
    emit({ id: task.id, label: task.label, phase: 'start' });
    try {
      const value = await task.run(results);
      timings[task.id] = Date.now() - start;
      results[task.id] = value;
      emit({ id: task.id, label: task.label, phase: 'complete', durationMs: timings[task.id] });
      return value;
    } catch (error) {
      timings[task.id] = Date.now() - start;
      emit({
        id: task.id,
        label: task.label,
        phase: 'error',
        durationMs: timings[task.id],
        error: error && error.message ? error.message : String(error)
      });
      if (task.critical !== false) throw error;
      results[task.id] = task.fallback;
      return task.fallback;
    }
  }

  const nonCriticalPromise = Promise.all(nonCritical.map(runTask));
  await Promise.all(critical.map(runTask));
  await Promise.allSettled([nonCriticalPromise]);
  return { results, timings };
}

async function waitForReveal({ splashStartedAt, criticalReady, minSplashMs = DEFAULT_MIN_SPLASH_MS, timeoutMs = DEFAULT_STARTUP_TIMEOUT_MS }) {
  const timedCritical = Promise.race([
    criticalReady,
    delay(timeoutMs).then(() => ({ timedOut: true }))
  ]);
  const result = await timedCritical;
  const elapsed = Date.now() - splashStartedAt;
  await delay(minSplashMs - elapsed);
  return {
    timedOut: Boolean(result && result.timedOut),
    elapsedBeforeRevealMs: Date.now() - splashStartedAt
  };
}

module.exports = {
  DEFAULT_MIN_SPLASH_MS,
  DEFAULT_STARTUP_TIMEOUT_MS,
  delay,
  runStartupTasks,
  waitForReveal
};
