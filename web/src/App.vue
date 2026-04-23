<script setup lang="ts">
import AppShell from './components/layout/AppShell.vue';
import { Toaster } from 'vue-sonner';
import { useTheme } from './composables/useTheme.ts';
import { useRoute } from 'vue-router';
import { computed } from 'vue';

useTheme();
const route = useRoute();
const isLoginPage = computed(() => route.name === 'login');
</script>

<template>
  <template v-if="isLoginPage">
    <RouterView />
  </template>
  <AppShell v-else>
    <RouterView />
  </AppShell>
  <Toaster rich-colors position="bottom-right" />
</template>


