<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Check, ChevronDown } from 'lucide-vue-next';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
  description?: string;
}

const props = withDefaults(defineProps<{
  modelValue: string[];
  options: Option[];
  placeholder?: string;
  class?: string;
}>(), {
  placeholder: 'Select options',
  class: '',
});

const emit = defineEmits<{ 'update:modelValue': [string[]] }>();
const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

const selectedOptions = computed(() => props.options.filter(option => props.modelValue.includes(option.value)));
const triggerLabel = computed(() => {
  if (selectedOptions.value.length === 0) return props.placeholder;
  if (selectedOptions.value.length === 1) return selectedOptions.value[0]?.label ?? props.placeholder;
  return `${selectedOptions.value.length} selected`;
});

function toggleOption(value: string) {
  const next = props.modelValue.includes(value)
    ? props.modelValue.filter(item => item !== value)
    : [...props.modelValue, value];
  emit('update:modelValue', next);
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!(event.target instanceof Node) || dropdownRef.value?.contains(event.target)) {
    return;
  }

  isOpen.value = false;
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown);
});
</script>

<template>
  <div ref="dropdownRef" class="relative" @keydown.escape="isOpen = false">
    <button
      type="button"
      :class="cn('flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2', props.class)"
      @click="isOpen = !isOpen"
    >
      <span :class="selectedOptions.length === 0 ? 'text-muted-foreground' : 'text-foreground'">{{ triggerLabel }}</span>
      <ChevronDown :class="['h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180']" />
    </button>

    <div
      v-if="isOpen"
      class="absolute z-50 mt-2 w-full rounded-md border border-border bg-popover p-1 shadow-lg"
    >
      <div v-if="props.options.length === 0" class="px-3 py-2 text-sm text-muted-foreground">
        No options available.
      </div>

      <button
        v-for="option in props.options"
        :key="option.value"
        type="button"
        class="flex w-full items-start justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
        @click="toggleOption(option.value)"
      >
        <span class="min-w-0">
          <span class="block font-medium">{{ option.label }}</span>
          <span v-if="option.description" class="block text-xs text-muted-foreground">{{ option.description }}</span>
        </span>
        <Check v-if="props.modelValue.includes(option.value)" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      </button>
    </div>
  </div>
</template>

