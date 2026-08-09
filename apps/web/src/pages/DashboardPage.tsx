import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface TaskRow {
  id: string;
  name: string;
  base_value_pence: number;
  category: string;
  recurrence: string;
}

// Phase 1 scope: plain list view, no calendar and no theming yet
// (see docs/quokkaquest-spec.md — those land in Phase 2).
export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listTasks()
      .then((rows) => setTasks(rows as TaskRow[]))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load tasks'));
  }, []);

  return (
    <div style={{ maxWidth: 480, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>My Tasks</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            {task.name} — £{(task.base_value_pence / 100).toFixed(2)} ({task.category},{' '}
            {task.recurrence})
          </li>
        ))}
      </ul>
      {tasks.length === 0 && !error && <p>No tasks assigned yet.</p>}
    </div>
  );
}
