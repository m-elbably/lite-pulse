<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronDown, BellRing, SlidersHorizontal, Shield } from 'lucide-vue-next';
import MaintenanceWindowsEditor from './MaintenanceWindowsEditor.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown.vue';
import Select from '@/components/ui/Select.vue';
import Textarea from '@/components/ui/Textarea.vue';
import { cloneEditableValue } from '@/lib/cloneEditableValue.ts';
import { HTTP_METHOD_OPTIONS } from '@/lib/httpMethods.ts';
import type { AlertChannel, ServiceConfig } from '@/types.ts';

const props = defineProps<{
  alertOptions: AlertChannel[];
  initialValue?: ServiceConfig | null;
  isSaving?: boolean;
}>();

const emit = defineEmits<{
  save: [ServiceConfig];
  cancel: [];
}>();

function createEmptyService(): ServiceConfig {
  return {
    id: '',
    name: '',
    type: 'http',
    url: 'https://',
    interval: 60,
    timeout: 10,
    method: 'GET',
    expectedStatus: 200,
    failureThreshold: 3,
    successThreshold: 2,
    alertChannels: [],
    maintenanceWindows: [],
    alertCooldownMinutes: 0,
  };
}

function normalizeService(value?: ServiceConfig | null): ServiceConfig {
  const base = createEmptyService();
  const editableValue = value ? cloneEditableValue(value) : null;

  return {
    ...base,
    ...(editableValue ?? {}),
    alertChannels: [...(editableValue?.alertChannels ?? [])],
    maintenanceWindows: cloneEditableValue(editableValue?.maintenanceWindows ?? []),
  };
}

const form = ref<ServiceConfig>(createEmptyService());
const headersText = ref('{}');
const error = ref('');
const showAlertingOptions = ref(false);
const showRequestOptions = ref(false);
const showMaintenanceOptions = ref(false);

watch(
  () => props.initialValue,
  value => {
    form.value = normalizeService(value);
    headersText.value = JSON.stringify(form.value.headers ?? {}, null, 2);
    error.value = '';
    showAlertingOptions.value = !!form.value.alertChannels.length || form.value.alertCooldownMinutes > 0;
    showRequestOptions.value = !!form.value.headers
      || !!form.value.sslExpiryWarningDays
      || (form.value.method !== undefined && form.value.method !== 'GET')
      || (form.value.expectedStatus !== undefined && form.value.expectedStatus !== 200);
    showMaintenanceOptions.value = !!form.value.maintenanceWindows.length;
  },
  { immediate: true },
);

const isHttp = computed(() => form.value.type === 'http');
const selectedAlertIds = computed({
  get: () => form.value.alertChannels,
  set: value => {
    form.value.alertChannels = value;
  },
});

const alertChannelOptions = computed(() => props.alertOptions.map(alert => ({
  value: alert.id,
  label: alert.name,
  description: alert.description || alert.type,
})));

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
    const next = JSON.parse(JSON.stringify(form.value)) as ServiceConfig;

    if (isHttp.value) {
      next.headers = parseHeaders(headersText.value);
    } else {
      next.headers = undefined;
      next.url = undefined;
      next.method = undefined;
      next.expectedStatus = undefined;
      next.sslExpiryWarningDays = undefined;
    }
    error.value = '';
    emit('save', next);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Please review the service settings.';
  }
}
</script>

<template>
  <form class="space-y-4 p-1" @submit.prevent="submit">
    <div v-if="error" class="rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm px-3 py-2">{{ error }}</div>

    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <Label for="service-name">Display name</Label>
        <Input id="service-name" v-model.trim="form.name" type="text" required />
      </div>
      <div class="space-y-1.5">
        <Label for="service-type">Type</Label>
        <Select id="service-type" v-model="form.type">
          <option value="http">HTTP</option>
          <option value="tcp">TCP</option>
        </Select>
      </div>
      <div class="space-y-1.5">
        <Label for="service-interval">Interval (seconds)</Label>
        <Input id="service-interval" v-model.number="form.interval" min="30" type="number" required />
      </div>
      <div class="space-y-1.5">
        <Label for="service-timeout">Timeout (seconds)</Label>
        <Input id="service-timeout" v-model.number="form.timeout" min="1" max="30" type="number" required />
      </div>
    </div>

    <div v-if="isHttp" class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5 col-span-2">
        <Label for="service-url">URL</Label>
        <Input id="service-url" v-model.trim="form.url" type="url" required />
      </div>
    </div>

    <div v-else class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <Label for="service-host">Host</Label>
        <Input id="service-host" v-model.trim="form.host" type="text" required />
      </div>
      <div class="space-y-1.5">
        <Label for="service-port">Port</Label>
        <Input id="service-port" v-model.number="form.port" min="1" max="65535" type="number" required />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <Label for="service-failure-threshold">Failure threshold</Label>
        <Input id="service-failure-threshold" v-model.number="form.failureThreshold" min="1" type="number" required />
      </div>
      <div class="space-y-1.5">
        <Label for="service-success-threshold">Success threshold</Label>
        <Input id="service-success-threshold" v-model.number="form.successThreshold" min="1" type="number" required />
      </div>
    </div>

    <div class="space-y-3">
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-left"
        @click="showAlertingOptions = !showAlertingOptions"
      >
        <span class="flex items-center gap-2 text-sm font-medium">
          <BellRing class="h-4 w-4 text-primary" />
          Alerting & cooldown
        </span>
        <ChevronDown :class="['h-4 w-4 text-muted-foreground transition-transform', showAlertingOptions && 'rotate-180']" />
      </button>

      <div v-if="showAlertingOptions" class="rounded-lg border border-border p-3">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:items-start">
          <div class="space-y-1.5">
            <Label for="service-cooldown-expanded">Alert cooldown (min)</Label>
            <Input id="service-cooldown-expanded" v-model.number="form.alertCooldownMinutes" min="0" type="number" />
            <p class="text-xs text-muted-foreground">Prevents repeated notifications while a service stays down.</p>
          </div>

          <div class="space-y-1.5">
            <Label for="service-alerts">Alert channels</Label>
            <MultiSelectDropdown
              id="service-alerts"
              v-model="selectedAlertIds"
              :options="alertChannelOptions"
              placeholder="Choose alert channels"
            />
            <p class="text-xs text-muted-foreground">Pick one or more channels that should receive incidents.</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isHttp" class="space-y-3">
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-left"
        @click="showRequestOptions = !showRequestOptions"
      >
        <span class="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal class="h-4 w-4 text-primary" />
          Request customization
        </span>
        <ChevronDown :class="['h-4 w-4 text-muted-foreground transition-transform', showRequestOptions && 'rotate-180']" />
      </button>

      <div v-if="showRequestOptions" class="rounded-lg border border-border p-3 space-y-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="space-y-1.5">
            <Label for="service-method">Method</Label>
            <Select id="service-method" v-model="form.method">
              <option v-for="method in HTTP_METHOD_OPTIONS" :key="method" :value="method">{{ method }}</option>
            </Select>
          </div>
          <div class="space-y-1.5">
            <Label for="service-status">Expected status</Label>
            <Input id="service-status" v-model.number="form.expectedStatus" min="100" max="599" type="number" />
          </div>
          <div class="space-y-1.5 md:col-span-2">
            <Label for="service-ssl">SSL expiry warning days</Label>
            <Input id="service-ssl" v-model.number="form.sslExpiryWarningDays" min="1" type="number" placeholder="14" />
            <p class="text-xs text-muted-foreground">Only relevant for HTTPS endpoints when you want expiry alerts.</p>
          </div>
        </div>

        <div class="space-y-1.5">
          <Label for="service-headers">Custom headers (JSON)</Label>
          <Textarea id="service-headers" v-model="headersText" spellcheck="false" class="font-mono text-xs" />
          <p class="text-xs text-muted-foreground flex items-center gap-1">
            <span class="inline-block w-3.5 h-3.5 rounded-full bg-muted-foreground/20 text-muted-foreground text-[10px] font-bold text-center leading-3.5">?</span>
            Object of key/value string pairs, e.g. <code class="bg-muted px-1 rounded text-[11px]">{"Authorization":"Bearer token"}</code>
          </p>
        </div>
      </div>
    </div>

    <div class="space-y-3">
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-left"
        @click="showMaintenanceOptions = !showMaintenanceOptions"
      >
        <span class="flex items-center gap-2 text-sm font-medium">
          <Shield class="h-4 w-4 text-primary" />
          Maintenance windows
        </span>
        <ChevronDown :class="['h-4 w-4 text-muted-foreground transition-transform', showMaintenanceOptions && 'rotate-180']" />
      </button>

      <div v-if="showMaintenanceOptions" class="rounded-lg border border-border p-3">
        <MaintenanceWindowsEditor v-model="form.maintenanceWindows" />
      </div>
    </div>

    <div class="flex gap-2 justify-end pt-2">
      <Button variant="outline" type="button" @click="emit('cancel')">Cancel</Button>
      <Button type="submit" :disabled="props.isSaving">{{ props.isSaving ? 'Saving…' : 'Save service' }}</Button>
    </div>
  </form>
</template>

