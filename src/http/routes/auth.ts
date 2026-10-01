import { Hono } from 'hono';
import { z } from 'zod';
import {
  loginAdmin, loginStatus, logoutAdmin, logoutStatus,
  isAdminSession, isStatusSession, isPublicStatusPage,
  getAdminAuthConfig, getStatusAuthConfig, SESSION_MAX_AGE,
  ADMIN_COOKIE, STATUS_COOKIE,
  setCookie, deleteCookie, getCookie,
} from '../auth';

export const authRoute = new Hono();
const CredentialsSchema = z.object({
  username: z.string().min(1).max(1024),
  password: z.string().min(1).max(1024),
});

for (const role of ['admin', 'status'] as const) {
  authRoute.post(`/${role}/login`, async c => {
    const parsed = CredentialsSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: { message: 'Username and password must be non-empty strings' } }, 400);
    const token = (role === 'admin' ? loginAdmin : loginStatus)(parsed.data.username, parsed.data.password);
    if (!token) return c.json({ error: { message: 'Invalid credentials' } }, 401);
    setCookie(c, role === 'admin' ? ADMIN_COOKIE : STATUS_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
      secure: new URL(c.req.url).protocol === 'https:' || c.req.header('x-forwarded-proto')?.split(',')[0]?.trim() === 'https',
    });
    return c.json({ ok: true });
  });
}

authRoute.post('/logout', c => {
  const adminToken = getCookie(c, ADMIN_COOKIE);
  const statusToken = getCookie(c, STATUS_COOKIE);
  if (adminToken) logoutAdmin(adminToken);
  if (statusToken) logoutStatus(statusToken);
  deleteCookie(c, ADMIN_COOKIE, { path: '/' });
  deleteCookie(c, STATUS_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoute.get('/me', c => {
  const adminAuthEnabled = !!getAdminAuthConfig();
  const statusAuthEnabled = !!getStatusAuthConfig();
  const adminSession = adminAuthEnabled && isAdminSession(getCookie(c, ADMIN_COOKIE));
  const admin = !adminAuthEnabled || adminSession;
  const publicStatus = isPublicStatusPage();
  const statusViewer = publicStatus || (!adminAuthEnabled && !statusAuthEnabled)
    || adminSession || (statusAuthEnabled && isStatusSession(getCookie(c, STATUS_COOKIE)));
  return c.json({ admin, statusViewer, publicStatus, adminAuthEnabled, statusAuthEnabled });
});
