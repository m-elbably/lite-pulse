<script setup lang="ts">
import { computed } from 'vue';
import { Plus, Trash2, Clock } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import type { MaintenanceWindow } from '../../types.ts';

const props = defineProps<{ modelValue: MaintenanceWindow[] }>();
const emit = defineEmits<{ 'update:modelValue': [MaintenanceWindow[]] }>();
const windows = computed(() => props.modelValue ?? []);

function updateWindow(index: number, patch: Partial<MaintenanceWindow>): void {
  emit('update:modelValue', windows.value.map((w, i) => (i === index ? { ...w, ...patch } : w)));
}

function addWindow(): void {
  emit('update:modelValue', [...windows.value, { startHour: 2, startMinute: 0, durationMinutes: 60 }]);
}

function removeWindow(index: number): void {
  emit('update:modelValue', windows.value.filter((_, i) => i !== index));
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Clock class="w-4 h-4 text-muted-foreground" />
        <div>
          <p class="text-sm font-medium leading-none">Maintenance windows</p>
          <p class="text-xs text-muted-foreground mt-0.5">Alerts suppressed, checks still run</p>
        </div>
      </div>
      <Button variant="outline" size="sm" type="button" class="gap-1.5 h-8 text-xs" @click="addWindow">
        <Plus class="w-3.5 h-3.5" /> Add window
      </Button>
    </div>

    <div v-if="windows.length === 0" class="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
      No maintenance windows — alerts fire 24/7.
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="(window, index) in windows"
        :key="index"
        class="rounded-lg border border-border bg-muted/30 p-3 space-y-3"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Window {{ index + 1 }}</span>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors"
            @click="removeWindow(index)"
          >
            <Trash2 class="w-3.5 h-3.5" /> Remove
          </button>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div class="space-y-1">
            <Label :for="`mw-hour-${index}`" class="text-xs">Start hour</Label>
            <Input
              :id="`mw-hour-${index}`"
              :model-value="String(window.startHour)"
              type="number"
              min="0"
              max="23"
              class="h-8 text-sm"
              @update:model-value="updateWindow(index, { startHour: Number($event) || 0 })"
            />
          </div>
          <div class="space-y-1">
            <Label :for="`mw-min-${index}`" class="text-xs">Start minute</Label>
            <Input
              :id="`mw-min-${index}`"
              :model-value="String(window.startMinute)"
              type="number"
              min="0"
              max="59"
              class="h-8 text-sm"
              @update:model-value="updateWindow(index, { startMinute: Number($event) || 0 })"
            />
          </div>
          <div class="space-y-1">
            <Label :for="`mw-dur-${index}`" class="text-xs">Duration (min)</Label>
            <Input
              :id="`mw-dur-${index}`"
              :model-value="String(window.durationMinutes)"
              type="number"
              min="1"
              class="h-8 text-sm"
              @update:model-value="updateWindow(index, { durationMinutes: Number($event) || 1 })"
            />
          </div>
        </div>

        <div class="space-y-1">
          <p class="text-xs text-muted-foreground">Days (leave unchecked for every day)</p>
          <div class="flex gap-1 flex-wrap">
            <button
              v-for="(label, d) in DAY_LABELS"
              :key="d"
              type="button"
              :class="['px-2 py-1 rounded text-xs font-medium border transition-colors', window.weekdays?.includes(d) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/60']"
              @click="() => {
                const current = window.weekdays ?? [];
                const next = current.includes(d) ? current.filter(x => x !== d) : [...current, d].sort();
                updateWindow(index, { weekdays: next.length ? next : undefined });
              }"
            >
              {{ label }}
            </button>
          </div>
          <p class="text-xs text-muted-foreground pt-2">
            {{ window.weekdays?.length ? `Active on: ${window.weekdays.map(d => DAY_LABELS[d]).join(', ')}` : 'Active every day' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
