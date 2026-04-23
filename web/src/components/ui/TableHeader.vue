<script setup lang="ts">
import { cn } from '@/lib/utils';
const p = defineProps<{ class?: string }>();
</script>
<template><thead :class="cn('[&_tr]:border-b', p.class)"><slot /></thead></template>
