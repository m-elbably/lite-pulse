import type { ApiErrorResponse } from '../types';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with HTTP ${response.status}`;

    try {
      const errorBody = (await response.json()) as ApiErrorResponse;
      message = errorBody.error?.message ?? message;
    } catch {
      // Ignore invalid JSON error bodies.
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

