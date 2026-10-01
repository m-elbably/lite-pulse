import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

type Theme = 'light' | 'dark' | 'system';

const theme = ref<Theme>('system');
const isDark = ref(false);

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  isDark.value = root.classList.contains('dark');
}

export function useTheme() {
  let media: MediaQueryList | undefined;
  const handleSystemTheme = () => { if (theme.value === 'system') applyTheme('system'); };
  onBeforeUnmount(() => media?.removeEventListener('change', handleSystemTheme));
  onMounted(() => {
    const saved = localStorage.getItem('lp-theme') as Theme | null;
    theme.value = saved ?? 'light';
    applyTheme(theme.value);

    media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', handleSystemTheme);
  });

  watch(theme, (val) => {
    localStorage.setItem('lp-theme', val);
    applyTheme(val);
  });

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    theme.value = isDark ? 'light' : 'dark';
  }

  return { theme, isDark, toggleTheme };
}

