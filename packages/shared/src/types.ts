// Shared domain types — kept in sync between apps/api and apps/web.
// See docs/architecture-decision.md and docs/multi-tenant-gdpr-plan.md for the rationale.

export type GuardianRole = 'owner' | 'co-admin' | 'viewer';
export type UserRole = GuardianRole | 'child';

export interface Household {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  household_id: string;
  role: UserRole;
  display_name: string;
  username: string; // login handle for all accounts, including children
  email: string | null; // guardians only — children don't need one (minimise data, AADC)
  theme: string | null; // e.g. 'animals', 'makeup-slime-fidget' — child accounts only
  date_of_birth: string | null; // used to derive age multiplier
  created_at: string;
  updated_at: string;
}

export type TaskCategory = 'chore' | 'task';
export type TaskRecurrence = 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';

// 1 = barely achieved ... 5 = above and beyond
export type AchievementRating = 1 | 2 | 3 | 4 | 5;

export interface Task {
  id: string;
  household_id: string;
  name: string;
  base_value_pence: number; // stored as integer pence to avoid float rounding issues
  category: TaskCategory;
  recurrence: TaskRecurrence;
  assigned_user_ids: string[];
  late_deduction_percent: number; // 0-100, configurable per task (falls back to household default)
  created_at: string;
  updated_at: string;
}

export interface TaskCompletion {
  id: string;
  household_id: string;
  task_id: string;
  user_id: string;
  scheduled_for: string; // date the task was due
  completed_at: string | null;
  rating: AchievementRating | null;
  is_late: boolean;
  earned_value_pence: number; // computed: base_value * rating% * age_multiplier, minus any deduction
  created_at: string;
}

// Achievement scale % mapping — see docs/open-questions.md, values are placeholders
// until the household finalises the exact breakdown.
export const ACHIEVEMENT_RATING_PERCENT: Record<AchievementRating, number> = {
  1: 20,
  2: 40,
  3: 60,
  4: 80,
  5: 100,
};
