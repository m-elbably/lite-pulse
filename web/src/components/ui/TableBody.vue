<script setup lang="ts">
import { cn } from '@/lib/utils';
const p = defineProps<{ class?: string }>();
</script>
<template><tbody :class="cn('[&_tr:last-child]:border-0', p.class)"><slot /></tbody></template>
