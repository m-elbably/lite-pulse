<script setup lang="ts">
import { TabsContent } from 'radix-vue';
import { cn } from '@/lib/utils';
const p = defineProps<{ value: string; class?: string }>();
</script>
<template>
  <TabsContent :value="p.value" :class="cn('mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', p.class)"><slot /></TabsContent>
</template>
