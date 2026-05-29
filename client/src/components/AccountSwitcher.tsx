import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Trash2, User } from 'lucide-react';
import { useAppState } from '../state/useAppState';

export default function AccountSwitcher() {
  const { authStatus, switchAccount, removeAccount, login } = useAppState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!authStatus) return null;

  const active = authStatus.accounts.find(a => a.sessionId === authStatus.activeSessionId);

  return (
    <div className="account-switcher" ref={ref}>
      <button className="account-btn" onClick={() => setOpen(!open)}>
        <User size={13} />
        <span>{active?.email ?? 'Account'}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="account-dropdown">
          {authStatus.accounts.map(account => (
            <div
              key={account.sessionId}
              className={`account-item${account.sessionId === authStatus.activeSessionId ? ' account-item-active' : ''}`}
            >
              <button
                className="account-item-select"
                onClick={() => { void switchAccount(account.sessionId); setOpen(false); }}
              >
                <User size={13} />
                <span>{account.email}</span>
              </button>
              <button
                className="account-item-remove"
                title="Remove account"
                onClick={e => { e.stopPropagation(); void removeAccount(account.sessionId); setOpen(false); }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <button className="account-item account-add" onClick={() => { login(); setOpen(false); }}>
            <Plus size={13} />
            <span>Add account</span>
          </button>
        </div>
      )}
    </div>
  );
}
