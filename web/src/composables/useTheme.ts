import { ref, watch, onMounted } from 'vue';

type Theme = 'light' | 'dark' | 'system';

const theme = ref<Theme>('system');

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function useTheme() {
  onMounted(() => {
    const saved = localStorage.getItem('lp-theme') as Theme | null;
    theme.value = saved ?? 'light';
    applyTheme(theme.value);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (theme.value === 'system') applyTheme('system');
    });
  });

  watch(theme, (val) => {
    localStorage.setItem('lp-theme', val);
    applyTheme(val);
  });

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    theme.value = isDark ? 'light' : 'dark';
  }

  return { theme, toggleTheme };
}

