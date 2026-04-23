<script setup lang="ts">
import Badge from '@/components/ui/Badge.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardDescription from '@/components/ui/CardDescription.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Table from '@/components/ui/Table.vue';
import TableHeader from '@/components/ui/TableHeader.vue';
import TableBody from '@/components/ui/TableBody.vue';
import TableRow from '@/components/ui/TableRow.vue';
import TableHead from '@/components/ui/TableHead.vue';
import TableCell from '@/components/ui/TableCell.vue';
import type { IncidentItem } from '../../types.ts';

defineProps<{
  incidents: IncidentItem[];
}>();

function formatDate(value: string | undefined): string {
  return value ? new Date(value).toLocaleString() : '—';
}

function formatDuration(duration: number | undefined, status: IncidentItem['status']): string {
  if (duration == null) {
    return status === 'open' ? 'ongoing' : '—';
  }

  const seconds = Math.round(duration / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Recent incidents</CardTitle>
      <CardDescription>Latest outages and recoveries across monitored services.</CardDescription>
    </CardHeader>
    <CardContent class="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Cause</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="incidents.length === 0">
            <TableCell colspan="5" class="text-center text-muted-foreground py-8">No incidents recorded yet.</TableCell>
          </TableRow>
          <TableRow v-for="incident in incidents" :key="incident.id">
            <TableCell class="font-medium">{{ incident.serviceName ?? incident.serviceId }}</TableCell>
            <TableCell class="text-muted-foreground">{{ formatDate(incident.openedAt) }}</TableCell>
            <TableCell>{{ formatDuration(incident.duration, incident.status) }}</TableCell>
            <TableCell class="text-muted-foreground">{{ incident.cause || '—' }}</TableCell>
            <TableCell>
              <Badge :variant="incident.status === 'open' ? 'destructive' : 'success'">
                {{ incident.status }}
              </Badge>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</template>
