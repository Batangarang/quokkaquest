import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getStoredUser, type TaskRow } from '../api/client';

const GUARDIAN_ROLES = ['owner', 'co-admin'];

// Phase 1 scope: plain list view, no calendar and no theming yet
// (see docs/choirs-tasks-app-spec.md — those land in Phase 2).
export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const user = getStoredUser();
  const isGuardian = user ? GUARDIAN_ROLES.includes(user.role) : false;

  function loadTasks() {
    api
      .listTasks()
      .then(setTasks)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load tasks'));
  }

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <div style={{ maxWidth: 480, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>{isGuardian ? 'Family Tasks' : 'My Tasks'}</h1>

      {isGuardian && (
        <p>
          <Link to="/tasks/new">+ Add a task</Link>
        </p>
      )}

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            {task.name} — £{(task.base_value_pence / 100).toFixed(2)} ({task.category},{' '}
            {task.recurrence}) — <Link to={`/tasks/${task.id}/complete`}>Mark complete</Link>
          </li>
        ))}
      </ul>
      {tasks.length === 0 && !error && <p>No tasks assigned yet.</p>}
    </div>
  );
}
