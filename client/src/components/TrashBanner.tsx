import { Trash2 } from 'lucide-react';
import { formatSize } from '../utils/formatSize';

interface Props {
  bytes: number;
}

export default function TrashBanner({ bytes }: Props) {
  return (
    <div className="trash-banner">
      <Trash2 size={15} />
      <span>
        Your Trash contains <strong>{formatSize(bytes)}</strong> —{' '}
        <a href="https://drive.google.com/drive/trash" target="_blank" rel="noopener noreferrer">
          empty it in Google Drive
        </a>{' '}
        to reclaim space.
      </span>
    </div>
  );
}
