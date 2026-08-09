import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireGuardian } from '../../middleware/auth';
import { completeTask, createTask, listAllTasksForHousehold, listTasksForUser } from './tasks.service';

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

// A child sees their own assigned tasks. A guardian with no ?userId= sees every
// task in the household (their "Family Tasks" overview); a guardian can still
// pass ?userId= to view one specific child's list.
const GUARDIAN_ROLES = ['owner', 'co-admin'];

tasksRouter.get('/', async (req, res, next) => {
  try {
    const requestedUserId = req.query.userId as string | undefined;
    const isGuardian = GUARDIAN_ROLES.includes(req.auth!.role);

    const tasks =
      isGuardian && !requestedUserId
        ? await listAllTasksForHousehold(req.auth!.householdId)
        : await listTasksForUser(req.auth!.householdId, requestedUserId ?? req.auth!.userId);

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
