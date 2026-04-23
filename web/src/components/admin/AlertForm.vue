<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue';
import { Mail, Webhook, Send } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Select from '@/components/ui/Select.vue';
import Textarea from '@/components/ui/Textarea.vue';
import { cloneEditableValue } from '@/lib/cloneEditableValue.ts';
import { HTTP_METHOD_OPTIONS } from '@/lib/httpMethods.ts';
import type { AlertChannel } from '@/types.ts';

const props = defineProps<{
  initialValue?: AlertChannel | null;
  isSaving?: boolean;
}>();

const emit = defineEmits<{
  save: [AlertChannel];
  cancel: [];
}>();

function createEmptyAlert(): AlertChannel {
  return { id: '', name: '', description: '', type: 'email', to: [], method: 'POST' };
}

function normalizeAlert(value?: AlertChannel | null): AlertChannel {
  const base = createEmptyAlert();
  const editableValue = value ? cloneEditableValue(value) : null;

  return {
    ...base,
    ...(editableValue ?? {}),
    to: [...(editableValue?.to ?? [])],
    headers: editableValue?.headers ? { ...editableValue.headers } : undefined,
  };
}

const form = ref<AlertChannel>(createEmptyAlert());
const recipientsText = ref('');
const headersText = ref('{}');
const error = ref('');

watch(
  () => props.initialValue,
  value => {
    form.value = normalizeAlert(value);
    recipientsText.value = (form.value.to ?? []).join(', ');
    headersText.value = JSON.stringify(form.value.headers ?? {}, null, 2);
    error.value = '';
  },
  { immediate: true },
);

const isEmail = computed(() => form.value.type === 'email');
const isWebhook = computed(() => form.value.type === 'webhook');
const isTelegram = computed(() => form.value.type === 'telegram');

watch(
  () => form.value.type,
  type => {
    if (type === 'email') {
      form.value.url = undefined;
      form.value.headers = undefined;
      form.value.chatId = undefined;
      form.value.botToken = undefined;
      form.value.method = undefined;
    } else if (type === 'webhook') {
      form.value.to = undefined;
      form.value.chatId = undefined;
      form.value.botToken = undefined;
      form.value.method = form.value.method || 'POST';
    } else {
      form.value.to = undefined;
      form.value.url = undefined;
      form.value.headers = undefined;
      form.value.method = undefined;
    }
    error.value = '';
  },
);

function parseHeaders(text: string): Record<string, string> | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Headers must be a JSON object.');
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') {
      throw new Error(`Header '${key}' must have a string value.`);
    }
  }

  return parsed as Record<string, string>;
}

function submit(): void {
  try {
    const next: AlertChannel = { ...toRaw(form.value) };

    if (isWebhook.value) {
      next.headers = parseHeaders(headersText.value);
      next.to = undefined;
      next.chatId = undefined;
      next.botToken = undefined;
      next.method = next.method?.trim() || 'POST';
    } else if (isEmail.value) {
      next.headers = undefined;
      next.url = undefined;
      next.method = undefined;
      next.chatId = undefined;
      next.botToken = undefined;
      next.to = recipientsText.value
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);
    } else {
      next.headers = undefined;
      next.url = undefined;
      next.method = undefined;
      next.to = undefined;
    }

    next.description = next.description?.trim() || undefined;

    error.value = '';
    emit('save', next);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Please review the alert settings.';
  }
}
</script>

<template>
  <form class="space-y-4 p-1" @submit.prevent="submit">
    <div v-if="error" class="rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm px-3 py-2">{{ error }}</div>

    <div class="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <div class="flex items-center gap-2 text-sm font-medium">
        <Mail v-if="isEmail" class="h-4 w-4 text-primary" />
        <Webhook v-else-if="isWebhook" class="h-4 w-4 text-primary" />
        <Send v-else class="h-4 w-4 text-primary" />
        <span v-if="isEmail">Email notifications</span>
        <span v-else-if="isWebhook">Webhook delivery</span>
        <span v-else>Telegram bot delivery</span>
      </div>
      <p class="mt-1 text-xs text-muted-foreground">
        <span v-if="isEmail">Send incident messages to one or more email recipients.</span>
        <span v-else-if="isWebhook">POST incident payloads to a URL with optional headers.</span>
        <span v-else>Use a bot token and chat ID to send Telegram alerts.</span>
      </p>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <Label for="alert-name">Alert name</Label>
        <Input id="alert-name" v-model.trim="form.name" type="text" required />
      </div>
      <div class="space-y-1.5">
        <Label for="alert-type">Type</Label>
        <Select id="alert-type" v-model="form.type">
          <option value="email">Email</option>
          <option value="webhook">Webhook</option>
          <option value="telegram">Telegram</option>
        </Select>
      </div>
    </div>

    <div class="space-y-1.5">
      <Label for="alert-description">Description</Label>
      <Textarea id="alert-description" v-model="form.description" placeholder="Who this alert is for or when it should be used" />
    </div>

    <div v-if="isEmail" class="space-y-1.5">
      <Label for="alert-recipients">Recipients</Label>
      <Textarea id="alert-recipients" v-model="recipientsText" placeholder="ops@example.com, oncall@example.com" />
      <p class="text-xs text-muted-foreground flex items-center gap-1">
        <span class="inline-block w-3.5 h-3.5 rounded-full bg-muted-foreground/20 text-muted-foreground text-[10px] font-bold text-center leading-3.5">?</span>
        Comma-separated email addresses, e.g. <code class="bg-muted px-1 rounded text-[11px]">ops@example.com, oncall@example.com</code>
      </p>
    </div>

    <template v-if="isWebhook">
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1.5 col-span-2">
          <Label for="alert-url">Webhook URL</Label>
          <Input id="alert-url" v-model.trim="form.url" type="url" required />
        </div>
        <div class="space-y-1.5">
          <Label for="alert-method">Method</Label>
          <Select id="alert-method" v-model="form.method">
            <option v-for="method in HTTP_METHOD_OPTIONS" :key="method" :value="method">{{ method }}</option>
          </Select>
        </div>
      </div>
      <div class="space-y-1.5">
        <Label for="alert-headers">Custom headers (JSON)</Label>
        <Textarea id="alert-headers" v-model="headersText" spellcheck="false" class="font-mono text-xs" />
        <p class="text-xs text-muted-foreground flex items-center gap-1">
          <span class="inline-block w-3.5 h-3.5 rounded-full bg-muted-foreground/20 text-muted-foreground text-[10px] font-bold text-center leading-3.5">?</span>
          e.g. <code class="bg-muted px-1 rounded text-[11px]">{"Authorization":"Bearer token"}</code>
        </p>
      </div>
    </template>

    <template v-if="isTelegram">
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <Label for="alert-chat">Chat ID</Label>
          <Input id="alert-chat" v-model.trim="form.chatId" type="text" required />
        </div>
        <div class="space-y-1.5">
          <Label for="alert-token">Bot token</Label>
          <Input id="alert-token" v-model.trim="form.botToken" type="text" required />
        </div>
      </div>
    </template>

    <div class="flex gap-2 justify-end pt-2">
      <Button variant="outline" type="button" @click="emit('cancel')">Cancel</Button>
      <Button type="submit" :disabled="props.isSaving">{{ props.isSaving ? 'Saving…' : 'Save alert' }}</Button>
    </div>
  </form>
</template>
