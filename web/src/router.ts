import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from './views/DashboardView.vue';
import AdminView from './views/AdminView.vue';
import LoginView from './views/LoginView.vue';
import { useAuth } from './composables/useAuth.ts';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/admin', name: 'admin', component: AdminView, meta: { requiresAdmin: true } },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.public) return true;

  const { fetchAuthState } = useAuth();
  const state = await fetchAuthState();

  if (to.name === 'dashboard' && state.publicStatus) return true;

  if (to.meta.requiresAdmin) {
    if (!state.admin) return { name: 'login', query: { redirect: to.fullPath, mode: 'admin' } };
    return true;
  }

  if (!state.statusViewer && !state.admin) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  return true;
});


