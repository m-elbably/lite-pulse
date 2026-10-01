<script setup lang="ts">
import { computed, ref } from 'vue';
import { ShieldAlert } from 'lucide-vue-next';
import SparklineChart from './SparklineChart.vue';
import SslDetailsDialog from './SslDetailsDialog.vue';
import Badge from '@/components/ui/Badge.vue';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import { getSslStatusDisplay } from '@/lib/getSslStatusDisplay';
import type { DashboardService, StatusHistoryItem } from '../../types.ts';

const props = defineProps<{ service: DashboardService }>();

const statusVariant = computed(() => {
  if (props.service.status === 'up') return 'success';
  if (props.service.status === 'down') return 'destructive';
  return 'secondary';
});

const historyBlocks = computed(() => {
  const history = props.service.history ?? [];
  return Array.from({ length: Math.max(60, history.length) }, (_, index) => {
    const sourceIndex = index - Math.max(0, 60 - history.length);
    return sourceIndex >= 0 ? history[sourceIndex] ?? null : null;
  });
});

function formatResponseTime(value: number | null): string {
  if (value === null) return '—';
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleTimeString() : '—';
}

// ── SSL warning ───────────────────────────────────────────────────────────────
const sslDialogOpen = ref(false);

const sslDisplay = computed(() => getSslStatusDisplay(
  props.service.sslStatus,
  props.service.sslExpiryWarningDays,
));

const sslFooterClass = computed(() => {
  const variant = sslDisplay.value?.variant;
  return variant ? `ssl-footer--${variant}` : null;
});

// ── History strip tooltip ────────────────────────────────────────────────────
const tooltip = ref<{ visible: boolean; x: number; y: number; item: StatusHistoryItem | null }>({
  visible: false, x: 0, y: 0, item: null,
});

function showBlockTooltip(event: MouseEvent, item: StatusHistoryItem | null) {
  if (!item) { tooltip.value.visible = false; return; }
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  tooltip.value = { visible: true, x: rect.left + rect.width / 2, y: rect.top - 8, item };
}

function hideBlockTooltip() {
  tooltip.value.visible = false;
}
</script>

<template>
  <Card :class="['overflow-hidden border-l-4', service.status === 'up' ? 'border-l-green-500' : service.status === 'down' ? 'border-l-red-500' : 'border-l-muted-foreground', service.paused ? 'opacity-70' : ''].join(' ')">
    <CardContent class="pt-4 pb-0 space-y-3">
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-semibold text-sm leading-tight">{{ service.name }}</h3>
        <div class="flex gap-1.5 shrink-0">
          <Badge :variant="statusVariant">
            {{ service.status === 'up' ? '● UP' : service.status === 'down' ? '● DOWN' : '● UNKNOWN' }}
          </Badge>
          <Badge v-if="service.stale" variant="warning">Stale</Badge>
          <Badge v-if="service.paused" variant="warning">⏸ Paused</Badge>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div>
          <p class="text-xs text-muted-foreground">Response</p>
          <p class="text-sm font-semibold">{{ formatResponseTime(service.responseTime) }}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">Uptime 24h</p>
          <p class="text-sm font-semibold">{{ service.uptime24h === null ? '—' : `${service.uptime24h}%` }}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">Last check</p>
          <p class="text-sm font-semibold">{{ formatTimestamp(service.lastCheckedAt) }}</p>
        </div>
      </div>

      <div class="history-strip">
        <span
          v-for="(item, index) in historyBlocks"
          :key="`${service.id}-${index}`"
          class="history-strip__block"
          :class="item ? `history-strip__block--${item.status}` : ''"
          @mouseenter="showBlockTooltip($event, item)"
          @mouseleave="hideBlockTooltip"
        />
      </div>
      <div class="history-strip__legend">
        <span>60 checks ago</span>
        <span>Now</span>
      </div>

      <SparklineChart :history="service.history" />

      <!-- SSL certificate footer -->
      <button
        v-if="sslDisplay && sslFooterClass"
        type="button"
        class="ssl-footer"
        :class="sslFooterClass"
        @click="sslDialogOpen = true"
      >
        <ShieldAlert class="w-3.5 h-3.5 shrink-0" />
        <span>{{ sslDisplay.label }}</span>
        <span class="ml-auto text-[10px] opacity-70">Details →</span>
      </button>

      <!-- Spacer when no SSL banner to keep padding consistent -->
      <div v-else class="pb-4" />
    </CardContent>
  </Card>

  <!-- History strip tooltip -->
  <Teleport to="body">
    <div
      v-if="tooltip.visible && tooltip.item"
      class="history-block-tooltip"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
    >
      <template v-if="tooltip.item.status === 'down'">
        <span class="tooltip-status tooltip-status--down">● DOWN</span>
      </template>
      <template v-else>
        <span class="tooltip-latency">{{ tooltip.item.responseTime }}ms</span>
      </template>
      <span v-if="tooltip.item.checkedAt" class="tooltip-time">
        {{ new Date(tooltip.item.checkedAt).toLocaleTimeString() }}
      </span>
    </div>
  </Teleport>

  <!-- SSL details dialog -->
  <SslDetailsDialog
    v-if="service.sslStatus"
    :open="sslDialogOpen"
    :service-name="service.name"
    :ssl="service.sslStatus"
    :warning-days="service.sslExpiryWarningDays"
    @update:open="sslDialogOpen = $event"
  />
</template>

