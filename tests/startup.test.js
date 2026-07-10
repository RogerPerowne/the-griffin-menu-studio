const test = require('node:test');
const assert = require('node:assert/strict');
const { runStartupTasks, waitForReveal } = require('../electron/startup');

test('startup tasks use fallbacks for non-critical failures', async () => {
  const events = [];
  const result = await runStartupTasks([
    { id: 'critical', label: 'Critical', run: async () => 'ok' },
    { id: 'optional', label: 'Optional', critical: false, fallback: 'fallback', run: async () => { throw new Error('nope'); } }
  ], { emit: (event) => events.push(event) });

  assert.equal(result.results.critical, 'ok');
  assert.equal(result.results.optional, 'fallback');
  assert.equal(events.some((event) => event.id === 'optional' && event.phase === 'error'), true);
});

test('waitForReveal respects minimum splash duration', async () => {
  const started = Date.now();
  const result = await waitForReveal({
    splashStartedAt: started,
    criticalReady: Promise.resolve({ ok: true }),
    minSplashMs: 35,
    timeoutMs: 200
  });

  assert.equal(result.timedOut, false);
  assert.ok(result.elapsedBeforeRevealMs >= 30);
});

test('waitForReveal falls back on readiness timeout', async () => {
  const started = Date.now();
  const result = await waitForReveal({
    splashStartedAt: started,
    criticalReady: new Promise(() => {}),
    minSplashMs: 1,
    timeoutMs: 10
  });

  assert.equal(result.timedOut, true);
});
