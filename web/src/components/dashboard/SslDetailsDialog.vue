<script setup lang="ts">
import { computed } from 'vue';
import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-vue-next';
import Dialog from '@/components/ui/Dialog.vue';
import DialogHeader from '@/components/ui/DialogHeader.vue';
import DialogTitle from '@/components/ui/DialogTitle.vue';
import DialogDescription from '@/components/ui/DialogDescription.vue';
import { getSslStatusDisplay } from '@/lib/getSslStatusDisplay';
import type { SslStatus } from '../../types.ts';

const props = defineProps<{
  open: boolean;
  serviceName: string;
  ssl: SslStatus;
  warningDays?: number | null;
}>();

defineEmits<{ 'update:open': [boolean] }>();

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString();
}

const urgency = computed(() => getSslStatusDisplay(props.ssl, props.warningDays ?? null)?.variant ?? 'ok');
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogHeader>
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          :class="{
            'bg-red-500/15': urgency === 'critical' || urgency === 'error',
            'bg-yellow-500/15': urgency === 'warning',
            'bg-green-500/15': urgency === 'ok',
          }"
        >
          <ShieldX v-if="urgency === 'error'" class="h-5 w-5 text-red-500" />
          <ShieldAlert
            v-else-if="urgency === 'critical' || urgency === 'warning'"
            class="h-5 w-5"
            :class="urgency === 'critical' ? 'text-red-500' : 'text-yellow-500'"
          />
          <ShieldCheck v-else class="h-5 w-5 text-green-500" />
        </div>
        <div>
          <DialogTitle>SSL Certificate — {{ serviceName }}</DialogTitle>
          <DialogDescription>Current TLS certificate status for this service</DialogDescription>
        </div>
      </div>
    </DialogHeader>

    <!-- Error state -->
    <div v-if="ssl.error" class="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm px-4 py-3">
      ⚠️ SSL check failed: {{ ssl.error }}
    </div>

    <!-- Details grid -->
    <div v-else class="grid grid-cols-2 gap-3 text-sm">
      <div class="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
        <p class="text-xs text-muted-foreground">Hostname</p>
        <p class="font-semibold font-mono text-xs break-all">{{ ssl.hostname }}</p>
      </div>
      <div
        class="rounded-lg border p-3 space-y-1"
        :class="{
          'border-red-500/30 bg-red-500/10': urgency === 'critical',
          'border-yellow-500/30 bg-yellow-500/10': urgency === 'warning',
          'border-green-500/30 bg-green-500/10': urgency === 'ok',
        }"
      >
        <p class="text-xs text-muted-foreground">Days remaining</p>
        <p
          class="font-bold text-lg"
          :class="{
            'text-red-500': urgency === 'critical',
            'text-yellow-500': urgency === 'warning',
            'text-green-500': urgency === 'ok',
          }"
        >
          {{ ssl.daysRemaining }}
          <span class="text-xs font-normal text-muted-foreground">days</span>
        </p>
      </div>
      <div class="col-span-2 rounded-lg border border-border bg-muted/40 p-3 space-y-1">
        <p class="text-xs text-muted-foreground">Expires on</p>
        <p class="font-semibold">{{ formatDate(ssl.expiresAt) }}</p>
      </div>
      <div class="col-span-2 rounded-lg border border-border bg-muted/40 p-3 space-y-1">
        <p class="text-xs text-muted-foreground">Last checked</p>
        <p class="font-semibold">{{ formatDateTime(ssl.checkedAt) }}</p>
      </div>
    </div>
  </Dialog>
</template>

