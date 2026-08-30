import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AchievementRating } from '@quokkaquest/shared';
import { api, type TaskRow } from '../api/client';

const RATINGS: AchievementRating[] = [1, 2, 3, 4, 5];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Preview only — mirrors ACHIEVEMENT_RATING_PERCENT in packages/shared/src/types.ts
// and apps/api/src/modules/money/money.service.ts so the guardian/child can see the
// payout before submitting. Duplicated here (rather than imported) because the web
// build can't yet consume runtime values from @quokkaquest/shared — only types — due
// to a CJS/ESM interop issue in that package's build output. The server recomputes
// the authoritative value; this preview never needs to be exact.
const PREVIEW_RATING_PERCENT: Record<AchievementRating, number> = {
  1: 20,
  2: 40,
  3: 60,
  4: 80,
  5: 100,
};

function previewEarnedValuePence(task: TaskRow, rating: AchievementRating, isLate: boolean) {
  let value = Math.round((task.base_value_pence * PREVIEW_RATING_PERCENT[rating]) / 100);
  if (isLate && task.late_deduction_percent > 0) {
    value -= Math.round((value * task.late_deduction_percent) / 100);
  }
  return Math.max(0, value);
}

export default function CompleteTaskPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<TaskRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [scheduledFor, setScheduledFor] = useState(todayIso());
  const [rating, setRating] = useState<AchievementRating | null>(null);
  const [isLate, setIsLate] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listTasks()
      .then((tasks) => {
        const found = tasks.find((t) => t.id === taskId);
        if (!found) {
          setLoadError('Task not found.');
        } else {
          setTask(found);
        }
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load task'));
  }, [taskId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!taskId) return;
    if (!rating) return setError('Pick a rating from 1 to 5.');

    setSubmitting(true);
    try {
      await api.completeTask(taskId, { scheduledFor, rating, isLate });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Mark Complete{task ? `: ${task.name}` : ''}</h1>

      {loadError && <p style={{ color: 'crimson' }}>{loadError}</p>}

      {task && (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label>
              Date completed
              <br />
              <input
                type="date"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                required
              />
            </label>
          </div>

          <fieldset style={{ marginBottom: 12 }}>
            <legend>Rating (1 = barely achieved, 5 = above and beyond)</legend>
            {RATINGS.map((value) => (
              <label key={value} style={{ marginRight: 12 }}>
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  checked={rating === value}
                  onChange={() => setRating(value)}
                />{' '}
                {value}
              </label>
            ))}
          </fieldset>

          <div style={{ marginBottom: 12 }}>
            <label>
              <input type="checkbox" checked={isLate} onChange={(e) => setIsLate(e.target.checked)} />{' '}
              Completed late
            </label>
          </div>

          {rating && (
            <p>
              Estimated payout: £{(previewEarnedValuePence(task, rating, isLate) / 100).toFixed(2)}
            </p>
          )}

          {error && <p style={{ color: 'crimson' }}>{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Mark complete'}
          </button>
        </form>
      )}
    </div>
  );
}
