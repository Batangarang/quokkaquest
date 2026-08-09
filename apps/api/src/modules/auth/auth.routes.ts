import { Router } from 'express';
import { z } from 'zod';
import { login } from './auth.service';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const result = await login(username, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
