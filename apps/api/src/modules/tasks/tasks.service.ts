import type { AchievementRating, Task, TaskCategory, TaskRecurrence } from '@quokkaquest/shared';
import { withHouseholdContext } from '../../db/pool';
import { ApiError } from '../../middleware/error-handler';
import { calculateEarnedValue } from '../money/money.service';

interface CreateTaskInput {
  name: string;
  baseValuePence: number;
  category: TaskCategory;
  recurrence: TaskRecurrence;
  assignedUserIds: string[];
  lateDeductionPercent?: number;
}

export async function createTask(householdId: string, input: CreateTaskInput): Promise<Task> {
  return withHouseholdContext(householdId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO tasks (household_id, name, base_value_pence, category, recurrence, late_deduction_percent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, household_id, name, base_value_pence, category, recurrence,
                 late_deduction_percent, created_at, updated_at`,
      [
        householdId,
        input.name,
        input.baseValuePence,
        input.category,
        input.recurrence,
        input.lateDeductionPercent ?? 0,
      ],
    );
    const task = rows[0];

    for (const userId of input.assignedUserIds) {
      await client.query(
        `INSERT INTO task_assignments (task_id, user_id, household_id) VALUES ($1, $2, $3)`,
        [task.id, userId, householdId],
      );
    }

    return { ...task, assigned_user_ids: input.assignedUserIds } as Task;
  });
}

export async function listTasksForUser(householdId: string, userId: string) {
  return withHouseholdContext(householdId, async (client) => {
    const { rows } = await client.query(
      `SELECT t.id, t.name, t.base_value_pence, t.category, t.recurrence, t.late_deduction_percent
       FROM tasks t
       JOIN task_assignments ta ON ta.task_id = t.id
       WHERE ta.user_id = $1
       ORDER BY t.created_at DESC`,
      [userId],
    );
    return rows;
  });
}

interface CompleteTaskInput {
  taskId: string;
  userId: string;
  scheduledFor: string; // ISO date
  rating: AchievementRating;
  isLate: boolean;
}

/** Marks a scheduled task occurrence complete and computes the earned value. */
export async function completeTask(householdId: string, input: CompleteTaskInput) {
  return withHouseholdContext(householdId, async (client) => {
    const { rows: taskRows } = await client.query(
      `SELECT base_value_pence, late_deduction_percent FROM tasks WHERE id = $1`,
      [input.taskId],
    );
    const task = taskRows[0];
    if (!task) {
      throw new ApiError(404, 'Task not found');
    }

    const earnedValuePence = calculateEarnedValue({
      baseValuePence: task.base_value_pence,
      rating: input.rating,
      isLate: input.isLate,
      lateDeductionPercent: task.late_deduction_percent,
    });

    const { rows } = await client.query(
      `INSERT INTO task_completions
         (household_id, task_id, user_id, scheduled_for, completed_at, rating, is_late, earned_value_pence)
       VALUES ($1, $2, $3, $4, now(), $5, $6, $7)
       ON CONFLICT (task_id, user_id, scheduled_for)
       DO UPDATE SET completed_at = now(), rating = $5, is_late = $6, earned_value_pence = $7
       RETURNING *`,
      [
        householdId,
        input.taskId,
        input.userId,
        input.scheduledFor,
        input.rating,
        input.isLate,
        earnedValuePence,
      ],
    );

    return rows[0];
  });
}
