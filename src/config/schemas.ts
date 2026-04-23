import { z } from 'zod';

const MaintenanceWindowSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  startHour: z.number().int().min(0).max(23),
  startMinute: z.number().int().min(0).max(59).default(0),
  durationMinutes: z.number().int().min(1),
});

const ServiceConfigShape = {
  name: z.string().trim().min(1, 'name is required'),
  type: z.enum(['http', 'tcp']),
  url: z.string().trim().url().optional(),
  host: z.string().trim().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  interval: z.number().int().min(30),
  timeout: z.number().int().min(1).max(30),
  method: z.string().trim().min(1).optional().default('GET'),
  headers: z.record(z.string(), z.string()).optional(),
  expectedStatus: z.number().int().optional().default(200),
  failureThreshold: z.number().int().min(1),
  successThreshold: z.number().int().min(1),
  alertChannels: z.array(z.string().min(1)).optional().default([]),
  sslExpiryWarningDays: z.number().int().min(1).optional(),
  maintenanceWindows: z.array(MaintenanceWindowSchema).optional().default([]),
  alertCooldownMinutes: z.number().int().min(0).optional().default(0),
} satisfies z.ZodRawShape;

const AlertChannelShape = {
  name: z.string().trim().min(1, 'name is required'),
  description: z.string().trim().min(1).optional(),
  type: z.enum(['email', 'webhook', 'telegram']),
  to: z.array(z.string().email()).optional(),
  url: z.string().trim().url().optional(),
  method: z.string().trim().min(1).optional().default('POST'),
  headers: z.record(z.string(), z.string()).optional(),
  chatId: z.string().trim().min(1).optional(),
  botToken: z.string().trim().min(1).optional(),
} satisfies z.ZodRawShape;

const ServiceConfigBaseSchema = z.object({
  ...ServiceConfigShape,
});

const AlertChannelBaseSchema = z.object({
  ...AlertChannelShape,
});

function refineServiceSchema<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema
    .refine((value) => {
      const s = value as z.infer<typeof ServiceConfigBaseSchema>;
      return s.type !== 'http' || !!s.url;
    }, { message: 'url required for http type' })
    .refine((value) => {
      const s = value as z.infer<typeof ServiceConfigBaseSchema>;
      return s.type !== 'tcp' || (!!s.host && !!s.port);
    }, { message: 'host and port required for tcp type' })
    .refine(
      (value) => {
        const s = value as z.infer<typeof ServiceConfigBaseSchema>;
        return s.sslExpiryWarningDays === undefined || (s.type === 'http' && !!s.url && new URL(s.url).protocol === 'https:');
      },
      { message: 'sslExpiryWarningDays requires an https URL' },
    );
}

function refineAlertSchema<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema
    .refine((value) => {
      const c = value as z.infer<typeof AlertChannelBaseSchema>;
      return c.type !== 'telegram' || (!!c.chatId && !!c.botToken);
    }, {
      message: 'chatId and botToken required for telegram channels',
    })
    .refine((value) => {
      const c = value as z.infer<typeof AlertChannelBaseSchema>;
      return c.type !== 'email' || !!c.to?.length;
    }, {
      message: 'to required for email channels',
    })
    .refine((value) => {
      const c = value as z.infer<typeof AlertChannelBaseSchema>;
      return c.type !== 'webhook' || !!c.url;
    }, {
      message: 'url required for webhook channels',
    });
}

export const ServiceConfigSchema = refineServiceSchema(ServiceConfigBaseSchema.extend({
  id: z.string().trim().min(1),
}));

export const ServiceConfigInputSchema = refineServiceSchema(ServiceConfigBaseSchema.extend({
  id: z.string().trim().optional(),
}));

export const AlertChannelSchema = refineAlertSchema(AlertChannelBaseSchema.extend({
  id: z.string().trim().min(1),
}));

export const AlertChannelInputSchema = refineAlertSchema(AlertChannelBaseSchema.extend({
  id: z.string().trim().optional(),
}));

export type ValidatedServiceConfig = z.infer<typeof ServiceConfigSchema>;
export type ValidatedServiceConfigInput = z.input<typeof ServiceConfigInputSchema>;
export type ValidatedAlertChannel = z.infer<typeof AlertChannelSchema>;
export type ValidatedAlertChannelInput = z.input<typeof AlertChannelInputSchema>;
