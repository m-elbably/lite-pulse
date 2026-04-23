import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { requireAdminSession, loginAdmin, ADMIN_COOKIE } from '../../src/http/auth';

describe('session auth middleware', () => {
  it('returns 401 when no session cookie is present', async () => {
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'secret';
    const app = new Hono();
    app.use('*', requireAdminSession());
    app.get('/', c => c.text('ok'));
    const res = await app.request('/');
    expect(res.status).toBe(401);
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
  });

  it('allows requests with a valid session cookie', async () => {
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'secret';
    const token = loginAdmin('admin', 'secret');
    expect(token).not.toBeNull();
    const app = new Hono();
    app.use('*', requireAdminSession());
    app.get('/', c => c.text('ok'));
    const res = await app.request('/', {
      headers: { cookie: `${ADMIN_COOKIE}=${token}` },
    });
    expect(res.status).toBe(200);
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
  });

  it('returns null for invalid credentials', () => {
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'secret';
    const token = loginAdmin('admin', 'wrong');
    expect(token).toBeNull();
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
  });

  it('acts as a no-op when auth is disabled', async () => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    const app = new Hono();
    app.use('*', requireAdminSession());
    app.get('/', c => c.text('ok'));
    const res = await app.request('/');
    expect(res.status).toBe(200);
  });
});
