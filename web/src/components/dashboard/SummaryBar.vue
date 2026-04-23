<script setup lang="ts">
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';

defineProps<{ total: number; up: number; down: number }>();
</script>

<template>
  <div class="grid grid-cols-3 gap-4">
    <Card>
      <CardContent class="pt-4">
        <p class="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
        <p class="text-3xl font-bold mt-1">{{ total }}</p>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="pt-4">
        <p class="text-xs text-muted-foreground uppercase tracking-wide">Up</p>
        <p class="text-3xl font-bold mt-1 text-green-500">{{ up }}</p>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="pt-4">
        <p class="text-xs text-muted-foreground uppercase tracking-wide">Down</p>
        <p class="text-3xl font-bold mt-1 text-destructive">{{ down }}</p>
      </CardContent>
    </Card>
  </div>
</template>
