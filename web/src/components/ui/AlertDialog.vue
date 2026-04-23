<script setup lang="ts">
import {
  AlertDialogRoot,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from 'radix-vue';
import { cn } from '@/lib/utils';

defineProps<{
  open?: boolean;
  title?: string;
  description?: string;
  errorMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  variant?: 'default' | 'destructive';
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <AlertDialogRoot :open="open" @update:open="$emit('update:open', $event)">
    <slot name="trigger" />
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <AlertDialogContent class="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-xl">
        <div class="flex flex-col space-y-2">
          <AlertDialogTitle class="text-lg font-semibold">{{ title ?? 'Are you sure?' }}</AlertDialogTitle>
          <AlertDialogDescription class="text-sm text-muted-foreground">{{ description ?? 'This action cannot be undone.' }}</AlertDialogDescription>
        </div>
        <div v-if="errorMessage" class="rounded-md border border-destructive/30 bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {{ errorMessage }}
        </div>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <AlertDialogCancel
            class="mt-2 sm:mt-0 inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            :disabled="isConfirming"
            @click="emit('cancel')"
          >
            {{ cancelLabel ?? 'Cancel' }}
          </AlertDialogCancel>
          <button
            type="button"
            :class="cn('inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90')"
            :disabled="isConfirming"
            @click="emit('confirm')"
          >
            {{ isConfirming ? 'Working…' : (confirmLabel ?? 'Continue') }}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
