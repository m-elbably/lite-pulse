import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from './useAuth.ts';
import { ApiError, apiFetch } from './useApi.ts';
import type { IncidentsResponse, StatusResponse } from '../types.ts';

export function useDashboard() {
  const router = useRouter();
  const status = ref<StatusResponse | null>(null);
  const incidents = ref<IncidentsResponse | null>(null);
  const isLoading = ref(true);
  const isRefreshing = ref(false);
  const isOffline = ref(false);
  const errorMessage = ref('');
  const countdown = ref(30);
  let timer: number | undefined;
  let request: AbortController | undefined;
  let disposed = false;

  async function fetchAll(): Promise<void> {
    if (disposed || isRefreshing.value) return;
    isRefreshing.value = true;
    request = new AbortController();
    const signal = request.signal;
    try {
      const [statusPayload, incidentsPayload] = await Promise.all([
        apiFetch<StatusResponse>('/api/status', { signal }),
        apiFetch<IncidentsResponse>('/api/incidents?limit=20', { signal }),
      ]);
      if (disposed) return;
      status.value = statusPayload;
      incidents.value = incidentsPayload;
      isOffline.value = false;
      errorMessage.value = '';
    } catch (error) {
      if (disposed) return;
      request.abort();
      if (error instanceof ApiError && error.status === 401) {
        await router.replace({ name: 'login', query: { redirect: '/', mode: useAuth().authState.value?.statusAuthEnabled === false ? 'admin' : 'status' } });
      } else {
        isOffline.value = true;
        errorMessage.value = error instanceof Error ? error.message : String(error);
      }
    } finally {
      request = undefined;
      isRefreshing.value = false;
      isLoading.value = false;
      countdown.value = 30;
    }
  }

  function tick(): void {
    if (isRefreshing.value) return;
    countdown.value -= 1;
    if (countdown.value <= 0) void fetchAll();
  }

  const summary = computed(() => status.value?.summary ?? { total: 0, up: 0, down: 0, unknown: 0, paused: 0, stale: 0 });
  const services = computed(() => status.value?.services ?? []);
  const incidentItems = computed(() => incidents.value?.incidents ?? []);
  const lastRefreshed = computed(() => status.value ? new Date(status.value.generatedAt).toLocaleTimeString() : '—');

  onMounted(() => {
    timer = window.setInterval(tick, 1000);
    void fetchAll();
  });
  onBeforeUnmount(() => {
    disposed = true;
    if (timer !== undefined) window.clearInterval(timer);
    request?.abort();
  });

  return { countdown, errorMessage, incidentItems, isLoading, isRefreshing, isOffline, lastRefreshed, services, summary, refresh: fetchAll };
}
