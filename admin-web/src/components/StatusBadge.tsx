export function StatusBadge({ active }: { active: boolean }) {
  return <span className={`status-badge ${active ? 'status-active' : 'status-inactive'}`}>{active ? 'Active' : 'Inactive'}</span>;
}
