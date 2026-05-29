import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppState } from '../../state/useAppState';
import { formatSize } from '../../utils/formatSize';
import CategoryRow from './CategoryRow';

export default function Breakdown() {
  const { scanResult } = useAppState();
  const [selected, setSelected] = useState<string | null>(null);

  if (!scanResult) return null;

  const { categories } = scanResult;
  const sorted = Object.entries(categories).sort(([, a], [, b]) => b.totalBytes - a.totalBytes);

  if (selected) {
    const cat = categories[selected];
    const extensions = Object.entries(cat.extensions).sort(([, a], [, b]) => b.bytes - a.bytes);
    return (
      <div className="breakdown">
        <button className="back-btn" onClick={() => setSelected(null)}>
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="breakdown-header">
          <h2>{selected}</h2>
          <span className="breakdown-summary">{formatSize(cat.totalBytes)} · {cat.fileCount.toLocaleString()} files</span>
        </div>
        <div className="extension-list">
          {extensions.map(([ext, stat]) => (
            <div key={ext} className="extension-row">
              <span className="ext-name">{ext}</span>
              <span className="ext-count">{stat.count.toLocaleString()} files</span>
              <span className="ext-size">{formatSize(stat.bytes)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="breakdown">
      {sorted.map(([category, stat]) => (
        <CategoryRow
          key={category}
          category={category}
          stat={stat}
          onClick={() => setSelected(category)}
        />
      ))}
    </div>
  );
}
