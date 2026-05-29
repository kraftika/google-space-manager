import { useAppState } from '../state/useAppState';

export default function OwnerToggle() {
  const { ownerFilter, setOwnerFilter } = useAppState();

  return (
    <div
      className="owner-toggle"
      title="Files you own count against your Google quota. Shared files owned by others do not."
    >
      <button
        className={`toggle-pill${ownerFilter === 'owned' ? ' toggle-active' : ''}`}
        onClick={() => setOwnerFilter('owned')}
      >
        Files I Own
      </button>
      <button
        className={`toggle-pill${ownerFilter === 'all' ? ' toggle-active' : ''}`}
        onClick={() => setOwnerFilter('all')}
      >
        All Files
      </button>
    </div>
  );
}
