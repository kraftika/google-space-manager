import { QuotaInfo } from '../types/drive';
import { formatSize } from '../utils/formatSize';

interface Props {
  quota: QuotaInfo;
}

export default function QuotaBar({ quota }: Props) {
  const limit = parseInt(quota.limit ?? '0', 10);
  const used = parseInt(quota.usageInDrive ?? '0', 10);
  const pct = limit > 0 ? used / limit : 0;
  const color = pct > 0.95 ? '#ef4444' : pct > 0.8 ? '#f59e0b' : '#3b82f6';

  return (
    <div className="quota-bar-container">
      <span className="quota-text">{formatSize(used)} of {formatSize(limit)} used</span>
      <div className="quota-track">
        <div
          className="quota-fill"
          style={{ width: `${Math.min(pct * 100, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
