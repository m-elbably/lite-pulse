import { Hono } from 'hono';
import { join } from 'path';

export const dashboardRoute = new Hono();

const webDistDir = join(process.cwd(), 'web', 'dist');
const legacyDir = join(process.cwd(), 'web', 'legacy');

async function serveFile(filePath: string): Promise<Response | null> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return null;
  }

  return new Response(file);
}

function toRelativePath(requestPath: string): string {
  return requestPath.replace(/^\//, '') || 'index.html';
}

dashboardRoute.get('*', async c => {
  const requestPath = c.req.path;
  const distResponse = await serveFile(join(webDistDir, toRelativePath(requestPath)));
  if (distResponse) {
    return distResponse;
  }

  const legacyResponse = await serveFile(join(legacyDir, toRelativePath(requestPath)));
  if (legacyResponse) {
    return legacyResponse;
  }

  if (requestPath.includes('.')) {
    return c.notFound();
  }

  const appEntry = await serveFile(join(webDistDir, 'index.html'));
  if (appEntry) {
    return appEntry;
  }

  return c.html(
    '<!DOCTYPE html><html><body style="font-family: sans-serif; padding: 2rem"><h1>Web app not built</h1><p>Run <code>bun run build:web</code> before starting the server.</p></body></html>',
    503,
  );
});


