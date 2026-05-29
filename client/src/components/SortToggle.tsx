import { ArrowDownWideNarrow, ArrowUpNarrowWide, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import { useAppState, SortOption } from '../state/useAppState';

const OPTIONS: { value: SortOption; icon: React.ReactNode; label: string }[] = [
  { value: 'size-desc', icon: <ArrowDownWideNarrow size={13} />, label: 'Largest first' },
  { value: 'size-asc',  icon: <ArrowUpNarrowWide size={13} />,  label: 'Smallest first' },
  { value: 'name-asc',  icon: <ArrowDownAZ size={13} />,        label: 'Name A–Z' },
  { value: 'name-desc', icon: <ArrowUpZA size={13} />,          label: 'Name Z–A' },
];

export default function SortToggle() {
  const { sortOption, setSortOption } = useAppState();

  return (
    <div className="sort-toggle">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          className={`sort-pill${sortOption === opt.value ? ' sort-active' : ''}`}
          title={opt.label}
          onClick={() => setSortOption(opt.value)}
        >
          {opt.icon}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
