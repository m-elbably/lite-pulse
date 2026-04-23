import { Hono } from 'hono';
import { getRecentResults } from '../../db/repos';

export const historyRoute = new Hono();

historyRoute.get('/:serviceId', async (c) => {
  const serviceId = c.req.param('serviceId');
  const limitRaw = parseInt(c.req.query('limit') ?? '60', 10);

  if (isNaN(limitRaw) || limitRaw < 1 || limitRaw > 500) {
	return c.json({ error: 'limit must be an integer between 1 and 500' }, 400);
  }

  const results = await getRecentResults(serviceId, limitRaw);
  return c.json({ serviceId, results });
});


