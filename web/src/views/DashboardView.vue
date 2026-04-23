<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next';
import IncidentTable from '../components/dashboard/IncidentTable.vue';
import ServiceCard from '../components/dashboard/ServiceCard.vue';
import ServiceCardSkeleton from '../components/dashboard/ServiceCardSkeleton.vue';
import StatusBanner from '../components/dashboard/StatusBanner.vue';
import SummaryBar from '../components/dashboard/SummaryBar.vue';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardDescription from '@/components/ui/CardDescription.vue';
import CardContent from '@/components/ui/CardContent.vue';
import { useDashboard } from '../composables/useDashboard.ts';

const { countdown, errorMessage, incidentItems, isLoading, isOffline, lastRefreshed, services, summary, refresh } = useDashboard();
</script>

<template>
  <div class="space-y-6">
    <div v-if="isOffline" class="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm px-4 py-3">
      ⚠️ Cannot reach the monitoring server — showing the last known data.
      <span v-if="errorMessage"> ({{ errorMessage }})</span>
    </div>

    <Card>
      <CardHeader>
        <div class="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Operational overview</CardTitle>
            <CardDescription class="mt-2">
              {{ isOffline ? 'Retry in' : 'Auto-refresh in' }} <kbd class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono">{{ countdown }}</kbd>s · Last refreshed {{ lastRefreshed }}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" class="gap-2 shrink-0" @click="refresh">
            <RefreshCw class="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <StatusBanner :down-count="summary.down" />
        <SummaryBar :total="summary.total" :up="summary.up" :down="summary.down" />
      </CardContent>
    </Card>

    <div>
      <h2 class="text-lg font-semibold mb-1">Services</h2>
      <p class="text-sm text-muted-foreground mb-4">Current status, rolling history, and response-time trend per monitored service.</p>

      <!-- Skeleton while loading -->
      <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ServiceCardSkeleton v-for="i in 3" :key="i" />
      </div>

      <div v-else-if="services.length === 0" class="rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground text-sm">
        No services configured yet.
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ServiceCard v-for="service in services" :key="service.id" :service="service" />
      </div>
    </div>

    <IncidentTable :incidents="incidentItems" />
  </div>
</template>

