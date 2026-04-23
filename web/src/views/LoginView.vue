<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Eye, EyeOff } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardDescription from '@/components/ui/CardDescription.vue';
import CardContent from '@/components/ui/CardContent.vue';
import { useAuth } from '@/composables/useAuth.ts';

const props = defineProps<{ mode?: 'admin' | 'status' }>();

const router = useRouter();
const route = useRoute();
const { loginAdmin, loginStatus } = useAuth();

const username = ref('');
const password = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const error = ref('');

const isAdmin = computed(() => props.mode === 'admin' || route.query.mode === 'admin');

async function submit() {
  if (!username.value || !password.value) {
    error.value = 'Please enter your credentials.';
    return;
  }
  isLoading.value = true;
  error.value = '';
  try {
    if (isAdmin.value) {
      await loginAdmin(username.value, password.value);
    } else {
      await loginStatus(username.value, password.value);
    }
    const redirect = (route.query.redirect as string) ?? '/';
    await router.push(redirect);
  } catch {
    error.value = 'Invalid username or password.';
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-4">
    <div class="w-full max-w-sm">
      <div class="flex flex-col items-center mb-8 gap-2">
        <div class="rounded-[28px] bg-[linear-gradient(135deg,#0ea5e9_0%,#2563eb_45%,#10b981_100%)] p-0.75 shadow-lg ring-1 ring-black/5 dark:ring-white/10">
          <div class="rounded-3xl bg-white/90 px-3 py-3 backdrop-blur dark:bg-slate-950/85">
            <img src="/icon.svg" alt="LitePulse" class="h-18 w-18 max-h-18 max-w-18 object-contain drop-shadow-sm" />
          </div>
        </div>
        <h1 class="text-2xl font-bold tracking-tight">LitePulse</h1>
        <p class="text-muted-foreground text-sm">Service uptime monitoring</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle class="text-lg">{{ isAdmin ? 'Admin sign in' : 'Sign in' }}</CardTitle>
          <CardDescription>{{ isAdmin ? 'Access the admin console' : 'View the status dashboard' }}</CardDescription>
        </CardHeader>
        <CardContent>
          <form class="space-y-4" @submit.prevent="submit">
            <div v-if="error" class="rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm px-3 py-2">
              {{ error }}
            </div>

            <div class="space-y-2">
              <Label for="username">Username</Label>
              <Input id="username" v-model="username" type="text" autocomplete="username" placeholder="admin" :disabled="isLoading" />
            </div>

            <div class="space-y-2">
              <Label for="password">Password</Label>
              <div class="relative">
                <Input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  :disabled="isLoading"
                  class="pr-10"
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  @click="showPassword = !showPassword"
                >
                  <Eye v-if="!showPassword" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </button>
              </div>
            </div>

            <Button type="submit" class="w-full" :disabled="isLoading">
              {{ isLoading ? 'Signing in…' : 'Sign in' }}
            </Button>
          </form>

          <div v-if="!isAdmin" class="mt-4 text-center">
            <router-link to="/login?mode=admin" class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
              Admin sign in →
            </router-link>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>



