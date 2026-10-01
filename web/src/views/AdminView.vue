<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { toast } from 'vue-sonner';
import { Plus, Pencil, Trash2, Play, Pause, RefreshCw, Send } from 'lucide-vue-next';
import AlertForm from '../components/admin/AlertForm.vue';
import ServiceForm from '../components/admin/ServiceForm.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardDescription from '@/components/ui/CardDescription.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Dialog from '@/components/ui/Dialog.vue';
import DialogHeader from '@/components/ui/DialogHeader.vue';
import DialogTitle from '@/components/ui/DialogTitle.vue';
import DialogDescription from '@/components/ui/DialogDescription.vue';
import AlertDialog from '@/components/ui/AlertDialog.vue';
import Tabs from '@/components/ui/Tabs.vue';
import TabsList from '@/components/ui/TabsList.vue';
import TabsTrigger from '@/components/ui/TabsTrigger.vue';
import TabsContent from '@/components/ui/TabsContent.vue';
import Table from '@/components/ui/Table.vue';
import TableHeader from '@/components/ui/TableHeader.vue';
import TableBody from '@/components/ui/TableBody.vue';
import TableRow from '@/components/ui/TableRow.vue';
import TableHead from '@/components/ui/TableHead.vue';
import TableCell from '@/components/ui/TableCell.vue';
import { useAdminApi } from '../composables/useAdminApi.ts';
import { cloneEditableValue } from '../lib/cloneEditableValue.ts';
import type { AdminConfig, AlertChannel, DeliveryStatus, ServiceConfig } from '../types.ts';

const adminApi = useAdminApi();
const config = ref<AdminConfig>({ services: [], alerts: [] });
const deliveries = ref<Record<string, DeliveryStatus>>({});
const testingAlerts = ref<Set<string>>(new Set());
const pausedIds = ref<Set<string>>(new Set());
const isLoading = ref(true);
const isSaving = ref(false);
const activeTab = ref<'services' | 'alerts'>('services');

const serviceDialogOpen = ref(false);
const alertDialogOpen = ref(false);
const deleteServiceDialogOpen = ref(false);
const deleteAlertDialogOpen = ref(false);

const editingService = ref<ServiceConfig | null>(null);
const editingAlert = ref<AlertChannel | null>(null);
const pendingDeleteService = ref<ServiceConfig | null>(null);
const pendingDeleteAlert = ref<AlertChannel | null>(null);
const deleteServiceError = ref('');
const deleteAlertError = ref('');

async function refresh(): Promise<void> {
  try {
    isLoading.value = true;
    const [nextConfig, runtimeServices, deliveryResponse] = await Promise.all([
      adminApi.listConfig(),
      adminApi.listRuntimeServices(),
      adminApi.deliveryStatuses(),
    ]);
    config.value = nextConfig;
    deliveries.value = deliveryResponse.channels;
    pausedIds.value = new Set(runtimeServices.services.filter(s => s.paused).map(s => s.id));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    isLoading.value = false;
  }
}

async function saveService(service: ServiceConfig): Promise<void> {
  try {
    isSaving.value = true;
    config.value = editingService.value
      ? await adminApi.updateService(editingService.value.id, service)
      : await adminApi.createService(service);
    setServiceDialogOpen(false);
    toast.success(`Service '${service.name}' saved.`);
    await refresh();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    isSaving.value = false;
  }
}

function setServiceDialogOpen(open: boolean): void {
  serviceDialogOpen.value = open;
  if (!open) {
    editingService.value = null;
  }
}

async function confirmDeleteService(): Promise<void> {
  if (!pendingDeleteService.value) return;
  const { id: serviceId, name: serviceName } = pendingDeleteService.value;
  deleteServiceError.value = '';
  try {
    isSaving.value = true;
    config.value = await adminApi.deleteService(serviceId);
    toast.success(`Service '${serviceName}' deleted.`);
    deleteServiceDialogOpen.value = false;
    pendingDeleteService.value = null;
    await refresh();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deleteServiceError.value = message;
    toast.error(message);
  } finally {
    isSaving.value = false;
  }
}

async function togglePause(serviceId: string): Promise<void> {
  try {
    const serviceName = config.value.services.find(service => service.id === serviceId)?.name ?? 'Service';
    if (pausedIds.value.has(serviceId)) {
      await adminApi.resumeService(serviceId);
      toast.success(`Service '${serviceName}' resumed.`);
    } else {
      await adminApi.pauseService(serviceId);
      toast.success(`Service '${serviceName}' paused.`);
    }
    await refresh();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

async function testAlert(id: string): Promise<void> {
  if (testingAlerts.value.has(id)) return;
  testingAlerts.value.add(id);
  try {
    await adminApi.testAlert(id);
    toast.success('Test notification sent.');
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    testingAlerts.value.delete(id);
    try { deliveries.value = (await adminApi.deliveryStatuses()).channels; }
    catch { toast.error('Unable to refresh delivery status.'); }
  }
}

function formatDeliveryDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : '—';
}

async function saveAlert(alert: AlertChannel): Promise<void> {
  try {
    isSaving.value = true;
    config.value = editingAlert.value
      ? await adminApi.updateAlert(editingAlert.value.id, alert)
      : await adminApi.createAlert(alert);
    setAlertDialogOpen(false);
    toast.success(`Alert '${alert.name}' saved.`);
    await refresh();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    isSaving.value = false;
  }
}

function setAlertDialogOpen(open: boolean): void {
  alertDialogOpen.value = open;
  if (!open) {
    editingAlert.value = null;
  }
}

async function confirmDeleteAlert(): Promise<void> {
  if (!pendingDeleteAlert.value) return;
  const { id: alertId, name: alertName } = pendingDeleteAlert.value;
  deleteAlertError.value = '';
  try {
    isSaving.value = true;
    config.value = await adminApi.deleteAlert(alertId);
    toast.success(`Alert '${alertName}' deleted.`);
    deleteAlertDialogOpen.value = false;
    pendingDeleteAlert.value = null;
    await refresh();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deleteAlertError.value = message;
    toast.error(message);
  } finally {
    isSaving.value = false;
  }
}

function openNewService() {
  activeTab.value = 'services';
  editingService.value = null;
  serviceDialogOpen.value = true;
}

function openEditService(service: ServiceConfig) {
  activeTab.value = 'services';
  editingService.value = cloneEditableValue(service);
  serviceDialogOpen.value = true;
}

function openDeleteService(service: ServiceConfig) {
  activeTab.value = 'services';
  deleteServiceError.value = '';
  pendingDeleteService.value = service;
  deleteServiceDialogOpen.value = true;
}

function openNewAlert() {
  activeTab.value = 'alerts';
  editingAlert.value = null;
  alertDialogOpen.value = true;
}

function openEditAlert(alert: AlertChannel) {
  activeTab.value = 'alerts';
  editingAlert.value = cloneEditableValue(alert);
  alertDialogOpen.value = true;
}

function openDeleteAlert(alert: AlertChannel) {
  activeTab.value = 'alerts';
  deleteAlertError.value = '';
  pendingDeleteAlert.value = alert;
  deleteAlertDialogOpen.value = true;
}

function setDeleteServiceDialogOpen(open: boolean): void {
  deleteServiceDialogOpen.value = open;
  if (!open) {
    pendingDeleteService.value = null;
    deleteServiceError.value = '';
  }
}

function setDeleteAlertDialogOpen(open: boolean): void {
  deleteAlertDialogOpen.value = open;
  if (!open) {
    pendingDeleteAlert.value = null;
    deleteAlertError.value = '';
  }
}

onMounted(() => { void refresh(); });
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Admin console</h1>
      <p class="text-muted-foreground text-sm mt-1">Manage services and alert channels.</p>
    </div>

    <div v-if="isLoading" class="rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground text-sm">
      Loading admin data…
    </div>

    <Tabs v-else v-model="activeTab">
      <div class="flex items-center justify-between gap-4 mb-4">
        <TabsList>
          <TabsTrigger value="services">Services ({{ config.services.length }})</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({{ config.alerts.length }})</TabsTrigger>
        </TabsList>
        <Button variant="outline" size="sm" class="gap-2" @click="refresh">
          <RefreshCw class="w-3.5 h-3.5" /> Reload
        </Button>
      </div>

      <TabsContent value="services">
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <div>
                <CardTitle>Services</CardTitle>
                <CardDescription>Monitored endpoints and TCP ports.</CardDescription>
              </div>
              <Button size="sm" class="gap-2" @click="openNewService">
                <Plus class="w-4 h-4" /> New service
              </Button>
            </div>
          </CardHeader>
          <CardContent class="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead class="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="config.services.length === 0">
                  <TableCell colspan="5" class="text-center text-muted-foreground py-10">No services configured yet.</TableCell>
                </TableRow>
                <TableRow v-for="service in config.services" :key="service.id">
                  <TableCell>
                    <p class="font-medium">{{ service.name }}</p>
                  </TableCell>
                  <TableCell><Badge variant="outline">{{ service.type.toUpperCase() }}</Badge></TableCell>
                  <TableCell class="text-muted-foreground">{{ service.interval }}s</TableCell>
                  <TableCell>
                    <Badge :variant="pausedIds.has(service.id) ? 'warning' : 'success'">
                      {{ pausedIds.has(service.id) ? 'Paused' : 'Active' }}
                    </Badge>
                  </TableCell>
                  <TableCell class="text-right">
                    <div class="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" :title="pausedIds.has(service.id) ? 'Resume' : 'Pause'" @click="togglePause(service.id)">
                        <Play v-if="pausedIds.has(service.id)" class="w-4 h-4" />
                        <Pause v-else class="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Edit" @click="openEditService(service)">
                        <Pencil class="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Delete" class="text-destructive hover:text-destructive" @click="openDeleteService(service)">
                        <Trash2 class="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="alerts">
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <div>
                <CardTitle>Alert channels</CardTitle>
                <CardDescription>Destinations for incident and SSL notifications. Delivery status is shown since the last server restart.</CardDescription>
              </div>
              <Button size="sm" class="gap-2" @click="openNewAlert">
                <Plus class="w-4 h-4" /> New alert
              </Button>
            </div>
          </CardHeader>
          <CardContent class="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead class="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="config.alerts.length === 0">
                  <TableCell colspan="5" class="text-center text-muted-foreground py-10">No alert channels configured yet.</TableCell>
                </TableRow>
                <TableRow v-for="alert in config.alerts" :key="alert.id">
                  <TableCell class="font-medium">{{ alert.name }}</TableCell>
                  <TableCell><Badge variant="outline">{{ alert.type }}</Badge></TableCell>
                  <TableCell class="text-muted-foreground">{{ alert.description || '—' }}</TableCell>
                  <TableCell class="text-xs">
                    <p v-if="deliveries[alert.id]?.pending">Sending…</p>
                    <p v-else-if="deliveries[alert.id]?.error" class="text-destructive">{{ deliveries[alert.id]?.error }}</p>
                    <p v-else-if="deliveries[alert.id]?.lastSuccessAt" class="text-green-600 dark:text-green-400">Delivered</p>
                    <p v-else class="text-muted-foreground">No delivery yet</p>
                    <p v-if="deliveries[alert.id]" class="text-muted-foreground">Last success: {{ formatDeliveryDate(deliveries[alert.id]?.lastSuccessAt) }}</p>
                    <p v-if="deliveries[alert.id]" class="text-muted-foreground">Last attempt: {{ formatDeliveryDate(deliveries[alert.id]?.lastAttemptAt) }}</p>
                  </TableCell>
                  <TableCell class="text-right">
                    <div class="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" :disabled="testingAlerts.has(alert.id)" @click="testAlert(alert.id)">
                        <Send class="mr-1 h-3.5 w-3.5" /> {{ testingAlerts.has(alert.id) ? 'Sending…' : 'Send test' }}
                      </Button>
                      <Button variant="ghost" size="icon" title="Edit" @click="openEditAlert(alert)">
                        <Pencil class="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Delete" class="text-destructive hover:text-destructive" @click="openDeleteAlert(alert)">
                        <Trash2 class="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    <Dialog :open="serviceDialogOpen" class="max-w-2xl" @update:open="setServiceDialogOpen">
      <DialogHeader>
        <DialogTitle>{{ editingService ? `Edit service — ${editingService.name}` : 'New service' }}</DialogTitle>
        <DialogDescription>{{ editingService ? 'Update the service configuration.' : 'Add a new monitored endpoint.' }}</DialogDescription>
      </DialogHeader>
      <div class="max-h-[70vh] overflow-y-auto">
        <ServiceForm
          :key="editingService?.id ?? 'new-service'"
          :alert-options="config.alerts"
          :initial-value="editingService"
          :is-saving="isSaving"
          @save="saveService"
          @cancel="setServiceDialogOpen(false)"
        />
      </div>
    </Dialog>

    <Dialog :open="alertDialogOpen" class="max-w-xl" @update:open="setAlertDialogOpen">
      <DialogHeader>
        <DialogTitle>{{ editingAlert ? `Edit alert — ${editingAlert.name}` : 'New alert channel' }}</DialogTitle>
        <DialogDescription>Configure an email, webhook, or Telegram alert.</DialogDescription>
      </DialogHeader>
      <div class="max-h-[70vh] overflow-y-auto">
        <AlertForm
          :key="editingAlert?.id ?? 'new-alert'"
          :initial-value="editingAlert"
          :is-saving="isSaving"
          @save="saveAlert"
          @cancel="setAlertDialogOpen(false)"
        />
      </div>
    </Dialog>

    <AlertDialog
      :open="deleteServiceDialogOpen"
      title="Delete service?"
      :description="`Are you sure you want to delete '${pendingDeleteService?.name ?? ''}'? This cannot be undone.`"
      :error-message="deleteServiceError"
      :is-confirming="isSaving"
      confirm-label="Delete"
      variant="destructive"
      @update:open="setDeleteServiceDialogOpen"
      @confirm="confirmDeleteService"
      @cancel="setDeleteServiceDialogOpen(false)"
    />

    <AlertDialog
      :open="deleteAlertDialogOpen"
      title="Delete alert channel?"
      :description="`Are you sure you want to delete '${pendingDeleteAlert?.name ?? ''}'? This cannot be undone.`"
      :error-message="deleteAlertError"
      :is-confirming="isSaving"
      confirm-label="Delete"
      variant="destructive"
      @update:open="setDeleteAlertDialogOpen"
      @confirm="confirmDeleteAlert"
      @cancel="setDeleteAlertDialogOpen(false)"
    />
  </div>
</template>


