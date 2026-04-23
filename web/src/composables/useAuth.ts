import { ref } from 'vue';
import { apiFetch } from './useApi.ts';

export interface AuthState {
  admin: boolean;
  statusViewer: boolean;
  publicStatus: boolean;
  adminAuthEnabled: boolean;
  statusAuthEnabled: boolean;
}

const authState = ref<AuthState | null>(null);
let fetchPromise: Promise<AuthState> | null = null;

export function useAuth() {
  async function fetchAuthState(): Promise<AuthState> {
    if (fetchPromise) return fetchPromise;
    fetchPromise = apiFetch<AuthState>('/api/auth/me').then(state => {
      authState.value = state;
      fetchPromise = null;
      return state;
    });
    return fetchPromise;
  }

  async function loginAdmin(username: string, password: string): Promise<void> {
    await apiFetch('/api/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    authState.value = null;
    fetchPromise = null;
    await fetchAuthState();
  }

  async function loginStatus(username: string, password: string): Promise<void> {
    await apiFetch('/api/auth/status/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    authState.value = null;
    fetchPromise = null;
    await fetchAuthState();
  }

  async function logout(): Promise<void> {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    authState.value = null;
    fetchPromise = null;
  }

  return { authState, fetchAuthState, loginAdmin, loginStatus, logout };
}


