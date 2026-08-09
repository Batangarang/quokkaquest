import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { listHouseholdMembers } from './users.service';

export const usersRouter = Router();

usersRouter.use(requireAuth);

// Any household member can see who else is in the household (needed e.g. so a
// parent can pick which child to assign a task to). Isolation is still enforced
// by household_id — this never leaks across households.
usersRouter.get('/', async (req, res, next) => {
  try {
    const members = await listHouseholdMembers(req.auth!.householdId);
    res.json(members);
  } catch (err) {
    next(err);
  }
});
