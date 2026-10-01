import { timingSafeEqual, randomBytes } from 'crypto';
import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const adminSessions = new Map<string, number>();
const statusSessions = new Map<string, number>();

function safeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    timingSafeEqual(aBuffer, aBuffer);
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

function createSession(sessions: Map<string, number>): string {
  const now = Date.now();
  for (const [token, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(token);
  }
  const token = randomBytes(32).toString('hex');
  sessions.set(token, now + SESSION_MAX_AGE * 1000);
  return token;
}

function hasSession(sessions: Map<string, number>, token: string | undefined): boolean {
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export interface AuthConfig {
  username: string;
  password: string;
}

export function getAdminAuthConfig(): AuthConfig | null {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username && !password) return null;
  if (!username || !password) throw new Error('Both ADMIN_USERNAME and ADMIN_PASSWORD must be set together');
  return { username, password };
}

export function getStatusAuthConfig(): AuthConfig | null {
  const username = process.env.STATUS_USERNAME;
  const password = process.env.STATUS_PASSWORD;
  if (!username && !password) return null;
  if (!username || !password) throw new Error('Both STATUS_USERNAME and STATUS_PASSWORD must be set together');
  return { username, password };
}

export function isPublicStatusPage(): boolean {
  return process.env.PUBLIC_STATUS_PAGE === 'true';
}

export function loginAdmin(username: string, password: string): string | null {
  const config = getAdminAuthConfig();
  if (!config || !safeEquals(username, config.username) || !safeEquals(password, config.password)) return null;
  return createSession(adminSessions);
}

export function loginStatus(username: string, password: string): string | null {
  const config = getStatusAuthConfig();
  if (!config || !safeEquals(username, config.username) || !safeEquals(password, config.password)) return null;
  return createSession(statusSessions);
}

export function logoutAdmin(token: string): void { adminSessions.delete(token); }
export function logoutStatus(token: string): void { statusSessions.delete(token); }
export function isAdminSession(token: string | undefined): boolean { return hasSession(adminSessions, token); }
export function isStatusSession(token: string | undefined): boolean { return hasSession(statusSessions, token); }

export const ADMIN_COOKIE = 'vigil_admin_session';
export const STATUS_COOKIE = 'vigil_status_session';

export function requireAdminSession(): MiddlewareHandler {
  return async (c, next) => {
    if (!getAdminAuthConfig()) { await next(); return; }
    if (!isAdminSession(getCookie(c, ADMIN_COOKIE))) return c.json({ error: { message: 'Unauthorized' } }, 401);
    await next();
  };
}

export function requireStatusSession(): MiddlewareHandler {
  return async (c, next) => {
    const adminEnabled = !!getAdminAuthConfig();
    const statusEnabled = !!getStatusAuthConfig();
    if (isPublicStatusPage() || (!statusEnabled && !adminEnabled)) { await next(); return; }
    if ((statusEnabled && isStatusSession(getCookie(c, STATUS_COOKIE)))
      || (adminEnabled && isAdminSession(getCookie(c, ADMIN_COOKIE)))) {
      await next();
      return;
    }
    return c.json({ error: { message: 'Unauthorized' } }, 401);
  };
}

export { setCookie, deleteCookie, getCookie };
