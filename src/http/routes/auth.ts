import { Hono } from 'hono';
import {
  loginAdmin, loginStatus, logoutAdmin, logoutStatus,
  isAdminSession, isStatusSession, isPublicStatusPage,
  getAdminAuthConfig, getStatusAuthConfig,
  ADMIN_COOKIE, STATUS_COOKIE,
  setCookie, deleteCookie, getCookie,
} from '../auth';

export const authRoute = new Hono();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'Lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

authRoute.post('/admin/login', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>();
  const token = loginAdmin(username ?? '', password ?? '');
  if (!token) return c.json({ error: { message: 'Invalid credentials' } }, 401);
  setCookie(c, ADMIN_COOKIE, token, COOKIE_OPTS);
  return c.json({ ok: true });
});

authRoute.post('/status/login', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>();
  const token = loginStatus(username ?? '', password ?? '');
  if (!token) return c.json({ error: { message: 'Invalid credentials' } }, 401);
  setCookie(c, STATUS_COOKIE, token, COOKIE_OPTS);
  return c.json({ ok: true });
});

authRoute.post('/logout', (c) => {
  const adminToken = getCookie(c, ADMIN_COOKIE);
  const statusToken = getCookie(c, STATUS_COOKIE);
  if (adminToken) logoutAdmin(adminToken);
  if (statusToken) logoutStatus(statusToken);
  deleteCookie(c, ADMIN_COOKIE, { path: '/' });
  deleteCookie(c, STATUS_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoute.get('/me', (c) => {
  const adminToken = getCookie(c, ADMIN_COOKIE);
  const statusToken = getCookie(c, STATUS_COOKIE);
  const admin = isAdminSession(adminToken);
  const statusViewer = isStatusSession(statusToken) || admin;
  const publicStatus = isPublicStatusPage();
  const adminAuthEnabled = !!getAdminAuthConfig();
  const statusAuthEnabled = !!getStatusAuthConfig();
  return c.json({ admin, statusViewer, publicStatus, adminAuthEnabled, statusAuthEnabled });
});


