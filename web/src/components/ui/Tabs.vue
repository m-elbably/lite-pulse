<script setup lang="ts">
import { TabsRoot } from 'radix-vue';

defineProps<{ defaultValue?: string; modelValue?: string; class?: string }>();
defineEmits<{ 'update:modelValue': [string] }>();
</script>
<template>
  <TabsRoot :default-value="defaultValue" :model-value="modelValue" :class="$props.class" @update:model-value="$emit('update:modelValue', $event)">
    <slot />
  </TabsRoot>
</template>
