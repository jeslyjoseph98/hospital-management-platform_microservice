import { DAY_NAMES } from '../utils/format';

export interface TimingRowState {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export type TimingsState = Record<number, TimingRowState>;

export function emptyTimingsState(): TimingsState {
  const state: TimingsState = {};
  for (let day = 1; day <= 7; day += 1) {
    state[day] = { enabled: false, startTime: '', endTime: '' };
  }
  return state;
}

interface WeeklyTimingsEditorProps {
  value: TimingsState;
  onChange: (value: TimingsState) => void;
  errors?: Record<number, string>;
}

/**
 * 7-row Monday–Sunday editor: checkbox + start time + end time per day (SVC-07A §7).
 */
export function WeeklyTimingsEditor({ value, onChange, errors }: WeeklyTimingsEditorProps) {
  const updateRow = (day: number, patch: Partial<TimingRowState>) => {
    onChange({ ...value, [day]: { ...value[day], ...patch } });
  };

  return (
    <table className="timings-table">
      <thead>
        <tr>
          <th>Day</th>
          <th>Available</th>
          <th>Start time</th>
          <th>End time</th>
        </tr>
      </thead>
      <tbody>
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const row = value[day] ?? { enabled: false, startTime: '', endTime: '' };
          const rowError = errors?.[day];
          return (
            <tr key={day}>
              <td>{DAY_NAMES[day]}</td>
              <td>
                <input
                  type="checkbox"
                  aria-label={`${DAY_NAMES[day]} available`}
                  checked={row.enabled}
                  onChange={(e) => updateRow(day, { enabled: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="time"
                  aria-label={`${DAY_NAMES[day]} start time`}
                  value={row.startTime}
                  disabled={!row.enabled}
                  onChange={(e) => updateRow(day, { startTime: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="time"
                  aria-label={`${DAY_NAMES[day]} end time`}
                  value={row.endTime}
                  disabled={!row.enabled}
                  onChange={(e) => updateRow(day, { endTime: e.target.value })}
                />
                {rowError && (
                  <p className="field-error" role="alert">
                    {rowError}
                  </p>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Validates enabled rows: both times present and end > start. Returns per-day error messages. */
export function validateTimings(state: TimingsState): Record<number, string> {
  const errors: Record<number, string> = {};
  Object.entries(state).forEach(([dayStr, row]) => {
    const day = Number(dayStr);
    if (!row.enabled) return;
    if (!row.startTime || !row.endTime) {
      errors[day] = 'Start and end time are required';
      return;
    }
    if (row.endTime <= row.startTime) {
      errors[day] = 'End time must be after start time';
    }
  });
  return errors;
}

export function timingsStateToPayload(state: TimingsState): { dayOfWeek: number; startTime: string; endTime: string }[] {
  return Object.entries(state)
    .filter(([, row]) => row.enabled)
    .map(([dayStr, row]) => ({
      dayOfWeek: Number(dayStr),
      startTime: row.startTime,
      endTime: row.endTime,
    }));
}

export function timingsPayloadToState(
  timings: { dayOfWeek: number; startTime: string; endTime: string }[] | undefined,
): TimingsState {
  const state = emptyTimingsState();
  (timings ?? []).forEach((t) => {
    state[t.dayOfWeek] = { enabled: true, startTime: t.startTime, endTime: t.endTime };
  });
  return state;
}
