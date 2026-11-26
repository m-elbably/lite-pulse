import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useDocumentVisibility, useTitle } from '@vueuse/core';
import { useAuth } from './useAuth.ts';
import { ApiError, apiFetch } from './useApi.ts';
import type { IncidentsResponse, StatusResponse } from '../types.ts';

const INCIDENT_PAGE = 20;
const INCIDENT_MAX = 100; // API limit
const STATUS_ORDER = { down: 0, unknown: 1, up: 2 } as const;

export function useDashboard() {
  const router = useRouter();
  const status = ref<StatusResponse | null>(null);
  const incidents = ref<IncidentsResponse | null>(null);
  const incidentLimit = ref(INCIDENT_PAGE);
  const isLoading = ref(true);
  const isRefreshing = ref(false);
  const isOffline = ref(false);
  const errorMessage = ref('');
  const countdown = ref(30);
  const visibility = useDocumentVisibility();
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
        apiFetch<IncidentsResponse>(`/api/incidents?limit=${incidentLimit.value}`, { signal }),
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
    // Background tabs stop polling; they refresh as soon as they are visible again.
    if (isRefreshing.value || visibility.value === 'hidden') return;
    countdown.value -= 1;
    if (countdown.value <= 0) void fetchAll();
  }

  watch(visibility, value => { if (value === 'visible' && countdown.value < 30) void fetchAll(); });

  const summary = computed(() => status.value?.summary ?? { total: 0, up: 0, down: 0, unknown: 0, paused: 0, stale: 0 });
  // Problems first so an outage is visible without scrolling.
  const services = computed(() => [...(status.value?.services ?? [])].sort((a, b) =>
    Number(a.paused) - Number(b.paused) || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]));
  const incidentItems = computed(() => incidents.value?.incidents ?? []);
  const canLoadMoreIncidents = computed(() =>
    incidentLimit.value < INCIDENT_MAX && (incidents.value?.total ?? 0) > incidentItems.value.length);
  const lastRefreshed = computed(() => status.value ? new Date(status.value.generatedAt).toLocaleTimeString() : '—');

  useTitle(computed(() => {
    if (!status.value) return 'LitePulse';
    const { down } = status.value.summary;
    return down ? `(${down} down) LitePulse` : 'LitePulse';
  }));

  async function loadMoreIncidents(): Promise<void> {
    incidentLimit.value = Math.min(INCIDENT_MAX, incidentLimit.value + INCIDENT_PAGE);
    await fetchAll();
  }

  onMounted(() => {
    timer = window.setInterval(tick, 1000);
    void fetchAll();
  });
  onBeforeUnmount(() => {
    disposed = true;
    if (timer !== undefined) window.clearInterval(timer);
    request?.abort();
  });

  return {
    countdown, errorMessage, incidentItems, isLoading, isRefreshing, isOffline, lastRefreshed, services, summary,
    canLoadMoreIncidents, loadMoreIncidents, refresh: fetchAll,
  };
}
