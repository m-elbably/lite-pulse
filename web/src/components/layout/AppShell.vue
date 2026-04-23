<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Sun, Moon, LogOut, LayoutDashboard, Settings } from 'lucide-vue-next';
import Tabs from '@/components/ui/Tabs.vue';
import TabsList from '@/components/ui/TabsList.vue';
import TabsTrigger from '@/components/ui/TabsTrigger.vue';
import { useTheme } from '@/composables/useTheme.ts';
import { useAuth } from '@/composables/useAuth.ts';
import { toast } from 'vue-sonner';

const { toggleTheme } = useTheme();
const { authState, logout } = useAuth();
const router = useRouter();
const route = useRoute();

const isDark = computed(() => document.documentElement.classList.contains('dark'));
const activeTab = computed(() => (route.path === '/admin' ? 'admin' : 'dashboard'));

async function handleLogout() {
  await logout();
  toast.success('Signed out successfully');
  await router.push('/login');
}

async function handleTabChange(next: string) {
  if (next === activeTab.value) return;
  await router.push(next === 'admin' ? '/admin' : '/');
}

const iconBtnClass =
  'inline-flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="max-w-screen-xl mx-auto flex h-14 items-center justify-between gap-4 px-4">
        <RouterLink to="/" class="flex items-center gap-2.5 no-underline">
          <img src="/icon.svg" alt="LitePulse" class="h-8 w-8 object-contain" />
          <div class="hidden sm:block leading-tight">
            <span class="font-bold text-sm text-foreground">LitePulse</span>
            <span class="text-muted-foreground text-xs ml-2 hidden md:inline">Uptime monitoring</span>
          </div>
        </RouterLink>

        <div class="ml-auto flex items-center gap-3">
          <div v-if="authState?.admin" class="flex items-center gap-2">
            <Tabs :model-value="activeTab" @update:model-value="handleTabChange">
              <TabsList>
                <TabsTrigger value="dashboard" class="gap-1.5">
                  <LayoutDashboard class="h-4 w-4" />
                  <span>Dashboard</span>
                </TabsTrigger>
                <TabsTrigger value="admin" class="gap-1.5">
                  <Settings class="h-4 w-4" />
                  <span>Admin</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div class="flex items-center gap-1">
            <button :class="iconBtnClass" :title="isDark ? 'Switch to light' : 'Switch to dark'" @click="toggleTheme">
              <Sun v-if="isDark" class="w-4 h-4" />
              <Moon v-else class="w-4 h-4" />
            </button>
            <button v-if="authState?.admin || authState?.statusViewer" :class="iconBtnClass" title="Sign out" @click="handleLogout">
              <LogOut class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-screen-xl mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>



