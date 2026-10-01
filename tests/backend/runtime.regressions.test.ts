import { expect, it } from 'bun:test';

it('keeps monitoring, authentication, delivery, and dashboard regressions covered', async () => {
  // Isolate the real adapters and event bus from existing mock.module tests.
  const child = Bun.spawn([Bun.which('bun')!, `${import.meta.dir}/runtime.regressions.ts`], {
    env: { ...process.env, LOG_LEVEL: 'silent' }, stdout: 'pipe', stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  expect(`${stdout}\n${stderr}`.trim()).toBe('runtime regressions passed');
  expect(exitCode).toBe(0);
}, 15_000);
