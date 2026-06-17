import { GmailMessage } from '../../types/gmail';
import { formatSize } from '../../utils/formatSize';

interface Props {
  message: GmailMessage;
  selected: boolean;
  onToggle: (id: string) => void;
}

function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function EmailRow({ message, selected, onToggle }: Props) {
  return (
    <label className={`email-row${selected ? ' email-row-selected' : ''}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(message.id)}
      />
      <span className="email-from" title={message.from}>{message.from}</span>
      <span className="email-subject" title={message.subject}>
        {message.subject || '(no subject)'}
      </span>
      <span className="email-date">{formatDate(message.date)}</span>
      <span className="email-size">{formatSize(message.sizeEstimate)}</span>
    </label>
  );
}
