const TOKEN_KEY = 'quokkaquest_token';
const USER_KEY = 'quokkaquest_user';

export interface StoredUser {
  id: string;
  displayName: string;
  role: string;
  householdId: string;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token: string, user: StoredUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }

  return res.json();
}

export interface LoginResponse {
  token: string;
  user: StoredUser;
}

export interface TaskRow {
  id: string;
  name: string;
  base_value_pence: number;
  category: 'chore' | 'task';
  recurrence: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
}

export interface HouseholdMember {
  id: string;
  display_name: string;
  role: string;
}

export interface CreateTaskInput {
  name: string;
  baseValuePence: number;
  category: 'chore' | 'task';
  recurrence: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
  assignedUserIds: string[];
  lateDeductionPercent?: number;
}

export const api = {
  login: (username: string, password: string) =>
    apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  listTasks: (userId?: string) =>
    apiFetch<TaskRow[]>(userId ? `/tasks?userId=${userId}` : '/tasks'),
  createTask: (input: CreateTaskInput) =>
    apiFetch<TaskRow>('/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  listHouseholdMembers: () => apiFetch<HouseholdMember[]>('/users'),
};
