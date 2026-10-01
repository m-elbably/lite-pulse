import { Hono } from 'hono';
import { getDeliveryStatuses, testAlertChannel } from '../../alerts/dispatcher';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AlertChannelInputSchema, ServiceConfigInputSchema } from '../../config/schemas';
import {
  ConfigStoreError,
  createAlert,
  createService,
  deleteAlert,
  deleteService,
  listConfig,
  updateAlert,
  updateService,
} from '../../config/store';

export const adminRoute = new Hono();

function errorResponse(message: string, code = 'BAD_REQUEST') {
  return { error: { code, message } };
}

async function parseJson(c: Context): Promise<unknown> {
  try {
	return await c.req.json();
  } catch {
	throw new ConfigStoreError('Request body must be valid JSON', 400, 'INVALID_JSON');
  }
}

function handleRouteError(c: Context, error: unknown): Response {
  if (error instanceof ConfigStoreError) {
	return c.json(
	  errorResponse(error.message, error.code),
	  { status: error.status as ContentfulStatusCode },
	);
  }

  return c.json(errorResponse('Unexpected admin API error', 'INTERNAL_ERROR'), 500);
}

adminRoute.get('/config', async c => {
  try {
	return c.json(await listConfig());
  } catch (error) {
	return handleRouteError(c, error);
  }
});

adminRoute.post('/services', async c => {
  try {
	const parsed = ServiceConfigInputSchema.safeParse(await parseJson(c));
	if (!parsed.success) {
	  return c.json(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid service payload', 'VALIDATION_ERROR'), 422);
	}

	return c.json(await createService(parsed.data), 201);
  } catch (error) {
	return handleRouteError(c, error);
  }
});

adminRoute.put('/services/:id', async c => {
  try {
	const parsed = ServiceConfigInputSchema.safeParse(await parseJson(c));
	if (!parsed.success) {
	  return c.json(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid service payload', 'VALIDATION_ERROR'), 422);
	}

	return c.json(await updateService(c.req.param('id'), parsed.data));
  } catch (error) {
	return handleRouteError(c, error);
  }
});

adminRoute.delete('/services/:id', async c => {
  try {
	return c.json(await deleteService(c.req.param('id')));
  } catch (error) {
	return handleRouteError(c, error);
  }
});

adminRoute.post('/alerts', async c => {
  try {
	const parsed = AlertChannelInputSchema.safeParse(await parseJson(c));
	if (!parsed.success) {
	  return c.json(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid alert payload', 'VALIDATION_ERROR'), 422);
	}

	return c.json(await createAlert(parsed.data), 201);
  } catch (error) {
	return handleRouteError(c, error);
  }
});

adminRoute.put('/alerts/:id', async c => {
  try {
	const parsed = AlertChannelInputSchema.safeParse(await parseJson(c));
	if (!parsed.success) {
	  return c.json(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid alert payload', 'VALIDATION_ERROR'), 422);
	}

	return c.json(await updateAlert(c.req.param('id'), parsed.data));
  } catch (error) {
	return handleRouteError(c, error);
  }
});

adminRoute.delete('/alerts/:id', async c => {
  try {
	return c.json(await deleteAlert(c.req.param('id')));
  } catch (error) {
	return handleRouteError(c, error);
  }
});



adminRoute.get('/alerts/delivery', c => c.json({ channels: getDeliveryStatuses() }));

adminRoute.post('/alerts/:id/test', async c => {
  try {
    const config = await listConfig();
    const channel = config.alerts.find(channel => channel.id === c.req.param('id'));
    if (!channel) return c.json(errorResponse('Alert channel not found', 'ALERT_NOT_FOUND'), 404);
    try {
      await testAlertChannel(channel);
    } catch {
      return c.json(errorResponse('Test delivery failed. See the channel delivery status for details.', 'DELIVERY_FAILED'), 502);
    }
    return c.json({ ok: true });
  } catch (error) {
    return handleRouteError(c, error);
  }
});
