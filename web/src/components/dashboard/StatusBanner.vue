<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle2, XCircle, Clock } from 'lucide-vue-next';
import type { StatusResponse } from '../../types';
const props = defineProps<{ summary: StatusResponse['summary']; loading: boolean; offline: boolean }>();
const healthy = computed(() => !props.loading && !props.offline && props.summary.total > 0 && props.summary.up === props.summary.total);
const message = computed(() => {
  if (props.loading) return 'Checking service status…';
  if (props.offline) return 'Status unavailable — showing last known data';
  if (props.summary.total === 0) return 'No services configured';
  if (props.summary.down) return `${props.summary.down} service${props.summary.down > 1 ? 's' : ''} down`;
  if (props.summary.stale) return 'Some service checks are overdue';
  if (props.summary.unknown) return 'Waiting for confirmed service status';
  if (props.summary.paused) return 'Monitoring is paused for some services';
  return healthy.value ? 'All systems operational' : 'Service status incomplete';
});
</script>

<template>
  <div
    role="status"
    :class="['flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold', healthy ? 'bg-green-500/10 text-green-600 dark:text-green-400' : summary.down && !loading && !offline ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground']"
  >
    <CheckCircle2 v-if="healthy" class="w-4 h-4" />
    <XCircle v-else-if="summary.down && !loading && !offline" class="w-4 h-4" />
    <Clock v-else class="w-4 h-4" />
    <span>{{ message }}</span>
  </div>
</template>
