import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type HouseholdMember } from '../api/client';

// Guardian-only page — the API also enforces this server-side (requireGuardian
// middleware), this is just so a child doesn't stumble onto a confusing form.
export default function CreateTaskPage() {
  const navigate = useNavigate();

  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [baseValuePounds, setBaseValuePounds] = useState('');
  const [category, setCategory] = useState<'chore' | 'task'>('chore');
  const [recurrence, setRecurrence] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once');
  const [lateDeductionPercent, setLateDeductionPercent] = useState('0');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listHouseholdMembers()
      .then((all) => setMembers(all.filter((m) => m.role === 'child')))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load family'));
  }, []);

  function toggleAssignee(id: string) {
    setAssignedUserIds((prev) =>
      prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const pounds = Number(baseValuePounds);
    if (!name.trim()) return setError('Give the task a name.');
    if (Number.isNaN(pounds) || pounds < 0) return setError('Enter a valid base value.');
    if (assignedUserIds.length === 0) return setError('Assign the task to at least one child.');

    setSubmitting(true);
    try {
      await api.createTask({
        name: name.trim(),
        baseValuePence: Math.round(pounds * 100),
        category,
        recurrence,
        assignedUserIds,
        lateDeductionPercent: Number(lateDeductionPercent) || 0,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Add a Task</h1>

      {loadError && <p style={{ color: 'crimson' }}>{loadError}</p>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>
            Task name
            <br />
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Base value (£)
            <br />
            <input
              type="number"
              step="0.01"
              min="0"
              value={baseValuePounds}
              onChange={(e) => setBaseValuePounds(e.target.value)}
              required
            />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Category
            <br />
            <select value={category} onChange={(e) => setCategory(e.target.value as 'chore' | 'task')}>
              <option value="chore">Chore</option>
              <option value="task">Task</option>
            </select>
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Recurrence
            <br />
            <select
              value={recurrence}
              onChange={(e) =>
                setRecurrence(e.target.value as 'once' | 'daily' | 'weekly' | 'monthly')
              }
            >
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Late deduction (%)
            <br />
            <input
              type="number"
              min="0"
              max="100"
              value={lateDeductionPercent}
              onChange={(e) => setLateDeductionPercent(e.target.value)}
            />
          </label>
        </div>

        <fieldset style={{ marginBottom: 12 }}>
          <legend>Assign to</legend>
          {members.length === 0 && !loadError && <p>No children found on this household yet.</p>}
          {members.map((member) => (
            <label key={member.id} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={assignedUserIds.includes(member.id)}
                onChange={() => toggleAssignee(member.id)}
              />{' '}
              {member.display_name}
            </label>
          ))}
        </fieldset>

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create task'}
        </button>
      </form>
    </div>
  );
}
