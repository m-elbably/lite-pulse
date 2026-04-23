<script setup lang="ts">
import { CheckCircle2, XCircle } from 'lucide-vue-next';
const props = defineProps<{
  downCount: number;
}>();
</script>

<template>
  <div :class="['flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold', props.downCount === 0 ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-destructive/10 text-destructive']">
    <CheckCircle2 v-if="props.downCount === 0" class="w-4 h-4" />
    <XCircle v-else class="w-4 h-4" />
    <span v-if="props.downCount === 0">All systems operational</span>
    <span v-else>{{ props.downCount }} service{{ props.downCount > 1 ? 's' : '' }} down</span>
  </div>
</template>
