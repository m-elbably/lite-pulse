<script setup lang="ts">
import { cn } from '@/lib/utils';
const props = defineProps<{ class?: string; modelValue?: string }>();
defineEmits<{ 'update:modelValue': [string] }>();
</script>
<template>
  <select
    :value="props.modelValue"
    :class="cn('flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', props.class)"
    v-bind="$attrs"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <slot />
  </select>
</template>

