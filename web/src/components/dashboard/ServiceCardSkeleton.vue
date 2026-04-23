<template>
  <div class="rounded-xl border border-border bg-card overflow-hidden border-l-4 border-l-muted">
    <div class="p-6 pt-4 space-y-3">
      <!-- Header row -->
      <div class="flex items-start justify-between gap-2">
        <div class="h-4 w-32 rounded-md bg-muted animate-pulse" />
        <div class="h-5 w-14 rounded-full bg-muted animate-pulse" />
      </div>

      <!-- Stats row -->
      <div class="grid grid-cols-3 gap-2">
        <div v-for="i in 3" :key="i" class="space-y-1.5">
          <div class="h-3 w-16 rounded bg-muted animate-pulse" />
          <div class="h-4 w-10 rounded bg-muted animate-pulse" />
        </div>
      </div>

      <!-- History strip -->
      <div class="h-[1.1rem] rounded-full bg-muted animate-pulse" />
      <div class="flex justify-between">
        <div class="h-3 w-16 rounded bg-muted animate-pulse" />
        <div class="h-3 w-6 rounded bg-muted animate-pulse" />
      </div>

      <!-- Sparkline -->
      <div class="h-14 w-full rounded-md bg-muted animate-pulse" />
    </div>
  </div>
</template>

