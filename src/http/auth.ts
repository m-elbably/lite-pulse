import { timingSafeEqual, randomBytes } from 'crypto';
import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

const adminSessions = new Set<string>();
const statusSessions = new Set<string>();

function safeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
	timingSafeEqual(aBuffer, aBuffer);
	return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
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
  if (!config) {
	const token = generateToken();
	adminSessions.add(token);
	return token;
  }
  if (!safeEquals(username, config.username) || !safeEquals(password, config.password)) return null;
  const token = generateToken();
  adminSessions.add(token);
  return token;
}

export function loginStatus(username: string, password: string): string | null {
  const config = getStatusAuthConfig();
  if (!config) {
	const token = generateToken();
	statusSessions.add(token);
	return token;
  }
  if (!safeEquals(username, config.username) || !safeEquals(password, config.password)) return null;
  const token = generateToken();
  statusSessions.add(token);
  return token;
}

export function logoutAdmin(token: string): void { adminSessions.delete(token); }
export function logoutStatus(token: string): void { statusSessions.delete(token); }

export function isAdminSession(token: string | undefined): boolean {
  if (!token) return false;
  if (!getAdminAuthConfig()) return true;
  return adminSessions.has(token);
}

export function isStatusSession(token: string | undefined): boolean {
  if (!token) return false;
  if (isPublicStatusPage()) return true;
  if (!getStatusAuthConfig()) return true;
  return statusSessions.has(token);
}

export const ADMIN_COOKIE = 'vigil_admin_session';
export const STATUS_COOKIE = 'vigil_status_session';

export function requireAdminSession(): MiddlewareHandler {
  return async (c, next) => {
	if (!getAdminAuthConfig()) { await next(); return; }
	const token = getCookie(c, ADMIN_COOKIE);
	if (!isAdminSession(token)) return c.json({ error: { message: 'Unauthorized' } }, 401);
	await next();
  };
}

export function requireStatusSession(): MiddlewareHandler {
  return async (c, next) => {
	if (isPublicStatusPage()) { await next(); return; }
	if (!getStatusAuthConfig() && !getAdminAuthConfig()) { await next(); return; }
	const statusToken = getCookie(c, STATUS_COOKIE);
	const adminToken = getCookie(c, ADMIN_COOKIE);
	if (isStatusSession(statusToken) || isAdminSession(adminToken)) { await next(); return; }
	return c.json({ error: { message: 'Unauthorized' } }, 401);
  };
}

export { setCookie, deleteCookie, getCookie };


