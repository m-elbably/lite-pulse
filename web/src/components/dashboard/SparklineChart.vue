<script setup lang="ts">
import { computed } from 'vue';
import type { StatusHistoryItem } from '../../types.ts';

const props = defineProps<{
  history: StatusHistoryItem[];
}>();

const chartWidth = 240;
const chartHeight = 56;
const padding = 6;

const points = computed(() => {
  const upPoints = props.history.filter(item => item.status === 'up');
  if (upPoints.length === 0) {
    return '';
  }

  const values = upPoints.map(item => item.responseTime);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return props.history
    .map((item, index) => {
      if (item.status !== 'up') {
        return null;
      }

      const x = padding + (index / Math.max(props.history.length - 1, 1)) * (chartWidth - padding * 2);
      const y = chartHeight - padding - ((item.responseTime - min) / range) * (chartHeight - padding * 2);
      return `${x},${y}`;
    })
    .filter((value): value is string => value !== null)
    .join(' ');
});
</script>

<template>
  <svg class="sparkline" :viewBox="`0 0 ${chartWidth} ${chartHeight}`" role="img" aria-label="Response time history">
    <polyline
      v-if="points"
      :points="points"
      fill="none"
      stroke="#4ade80"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <text v-else x="50%" y="50%" fill="#64748b" text-anchor="middle" dominant-baseline="middle" font-size="12">
      No recent uptime data
    </text>
  </svg>
</template>

