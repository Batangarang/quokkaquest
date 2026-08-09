import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireGuardian } from '../../middleware/auth';
import { completeTask, createTask, listTasksForUser } from './tasks.service';

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

const createTaskSchema = z.object({
  name: z.string().min(1),
  baseValuePence: z.number().int().nonnegative(),
  category: z.enum(['chore', 'task']),
  recurrence: z.enum(['once', 'daily', 'weekly', 'monthly', 'custom']),
  assignedUserIds: z.array(z.string().uuid()).min(1),
  lateDeductionPercent: z.number().int().min(0).max(100).optional(),
});

// Only guardians (owner/co-admin) can create tasks — see RBAC table in
// docs/multi-tenant-gdpr-plan.md §1.
tasksRouter.post('/', requireGuardian, async (req, res, next) => {
  try {
    const input = createTaskSchema.parse(req.body);
    const task = await createTask(req.auth!.householdId, input);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// A child can view their own task list; guardians can pass ?userId= to view a
// specific child's list (still scoped to their own household by requireAuth).
tasksRouter.get('/', async (req, res, next) => {
  try {
    const targetUserId = (req.query.userId as string | undefined) ?? req.auth!.userId;
    const tasks = await listTasksForUser(req.auth!.householdId, targetUserId);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

const completeTaskSchema = z.object({
  scheduledFor: z.string().date(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  isLate: z.boolean().default(false),
});

// A child marks their own task complete and rates it; a guardian can also do
// this on a child's behalf (e.g. correcting a rating).
tasksRouter.post('/:taskId/complete', async (req, res, next) => {
  try {
    const body = completeTaskSchema.parse(req.body);
    const completion = await completeTask(req.auth!.householdId, {
      taskId: req.params.taskId,
      userId: req.auth!.userId,
      ...body,
    });
    res.status(201).json(completion);
  } catch (err) {
    next(err);
  }
});
