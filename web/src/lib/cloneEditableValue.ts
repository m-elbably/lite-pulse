import { toRaw } from 'vue';

export function cloneEditableValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') {
    return value;
  }

  return JSON.parse(JSON.stringify(toRaw(value))) as T;
}

