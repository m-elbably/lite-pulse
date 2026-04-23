import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { apiFetch } from './useApi.ts';
import type { IncidentsResponse, StatusResponse } from '../types.ts';

export function useDashboard() {
  const status = ref<StatusResponse | null>(null);
  const incidents = ref<IncidentsResponse | null>(null);
  const isLoading = ref(true);
  const isOffline = ref(false);
  const errorMessage = ref('');
  const countdown = ref(30);

  let timer: number | undefined;

  async function fetchAll(): Promise<void> {
    try {
      const [statusPayload, incidentsPayload] = await Promise.all([
        apiFetch<StatusResponse>('/api/status'),
        apiFetch<IncidentsResponse>('/api/incidents?limit=20'),
      ]);

      status.value = statusPayload;
      incidents.value = incidentsPayload;
      isOffline.value = false;
      errorMessage.value = '';
    } catch (error) {
      isOffline.value = true;
      errorMessage.value = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading.value = false;
    }
  }

  function tick(): void {
    countdown.value -= 1;

    if (countdown.value <= 0) {
      countdown.value = 30;
      void fetchAll();
    }
  }

  const summary = computed(() => status.value?.summary ?? { total: 0, up: 0, down: 0 });
  const services = computed(() => status.value?.services ?? []);
  const incidentItems = computed(() => incidents.value?.incidents ?? []);
  const lastRefreshed = computed(() => {
    if (!status.value) {
      return '—';
    }

    return new Date(status.value.generatedAt).toLocaleTimeString();
  });

  onMounted(async () => {
    await fetchAll();
    timer = window.setInterval(tick, 1000);
  });

  onBeforeUnmount(() => {
    if (timer) {
      window.clearInterval(timer);
    }
  });

  return {
    countdown,
    errorMessage,
    incidentItems,
    isLoading,
    isOffline,
    lastRefreshed,
    services,
    summary,
    refresh: fetchAll,
  };
}


