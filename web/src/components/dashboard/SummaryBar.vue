<script setup lang="ts">
import { computed } from 'vue';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import type { StatusResponse } from '../../types';

const props = defineProps<{ summary: StatusResponse['summary'] }>();

const tiles = computed(() => [
  { label: 'Total', value: props.summary.total, class: '' },
  { label: 'Up', value: props.summary.up, class: 'text-green-500' },
  { label: 'Down', value: props.summary.down, class: 'text-destructive' },
  { label: 'Unknown', value: props.summary.unknown, class: 'text-muted-foreground', hint: props.summary.stale ? `${props.summary.stale} overdue` : '' },
  { label: 'Paused', value: props.summary.paused, class: 'text-amber-500' },
]);
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
    <Card v-for="tile in tiles" :key="tile.label">
      <CardContent class="pt-4">
        <p class="text-xs text-muted-foreground uppercase tracking-wide">{{ tile.label }}</p>
        <p :class="['text-3xl font-bold mt-1', tile.class]">{{ tile.value }}</p>
        <p v-if="tile.hint" class="text-xs text-muted-foreground mt-1">{{ tile.hint }}</p>
      </CardContent>
    </Card>
  </div>
</template>
