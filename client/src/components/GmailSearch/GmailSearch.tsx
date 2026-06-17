import { useEffect, useMemo, useState } from 'react';
import { Trash2, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { useAppState } from '../../state/useAppState';
import { getGmailTemplates, triggerLogin } from '../../api/client';
import { GmailMessage, GmailTemplates } from '../../types/gmail';
import EmailRow from './EmailRow';

type SortKey = 'from' | 'subject' | 'date' | 'size';
type SortDir = 'asc' | 'desc';

// Size and date are most useful largest/newest-first; text columns A→Z.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  from: 'asc', subject: 'asc', date: 'desc', size: 'desc',
};

function compareMessages(a: GmailMessage, b: GmailMessage, key: SortKey): number {
  switch (key) {
    case 'from':    return a.from.localeCompare(b.from);
    case 'subject': return a.subject.localeCompare(b.subject);
    case 'size':    return a.sizeEstimate - b.sizeEstimate;
    case 'date': {
      const ta = Date.parse(a.date), tb = Date.parse(b.date);
      if (isNaN(ta) && isNaN(tb)) return 0;
      if (isNaN(ta)) return -1;
      if (isNaN(tb)) return 1;
      return ta - tb;
    }
  }
}

export default function GmailSearch() {
  const {
    gmailResult, gmailLoading, gmailSelectedIds, gmailScopeError,
    searchGmail, loadMoreGmail, trashSelected,
    toggleEmailSelection, selectAllEmails,
  } = useAppState();

  const [templates, setTemplates] = useState<GmailTemplates>({});
  const [template, setTemplate] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('size');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    getGmailTemplates().then(setTemplates).catch(() => setTemplates({}));
  }, []);

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

  const groups = Object.entries(templates).reduce<Record<string, [string, GmailTemplates[string]][]>>(
    (acc, entry) => {
      const group = entry[1].group;
      (acc[group] ??= []).push(entry);
      return acc;
    }, {},
  );

  const messages = useMemo(() => {
    const list = [...(gmailResult?.messages ?? [])];
    list.sort((a, b) => {
      const cmp = compareMessages(a, b, sortKey);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [gmailResult, sortKey, sortDir]);

  const allSelected = messages.length > 0 && gmailSelectedIds.size === messages.length;

  if (gmailScopeError) {
    return (
      <div className="gmail-panel">
        <div className="scope-error-banner">
          <AlertTriangle size={18} />
          <span>Gmail permissions required to search and manage your email.</span>
          <button className="scope-error-btn" onClick={() => triggerLogin()}>Re-authenticate</button>
        </div>
      </div>
    );
  }

  return (
    <div className="gmail-panel">
      <div className="gmail-controls">
        <select
          className="template-select"
          value={template}
          onChange={(e) => {
            setTemplate(e.target.value);
            if (e.target.value) searchGmail(e.target.value);
          }}
        >
          <option value="">Select a filter…</option>
          {Object.entries(groups).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map(([key, t]) => (
                <option key={key} value={key}>{t.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {gmailLoading && messages.length === 0 ? (
        <div className="panel-loading"><div className="spinner" /></div>
      ) : !gmailResult ? (
        <div className="panel-empty">Pick a filter above to find emails by size or age.</div>
      ) : messages.length === 0 ? (
        <div className="panel-empty">No emails match this filter.</div>
      ) : (
        <>
          <div className="email-list">
            <div className="email-list-header">
              <input type="checkbox" checked={allSelected} onChange={selectAllEmails} />
              <button className="email-from email-sort" onClick={() => onSort('from')}>
                From {sortKey === 'from' && (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
              </button>
              <button className="email-subject email-sort" onClick={() => onSort('subject')}>
                Subject {sortKey === 'subject' && (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
              </button>
              <button className="email-date email-sort" onClick={() => onSort('date')}>
                Date {sortKey === 'date' && (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
              </button>
              <button className="email-size email-sort" onClick={() => onSort('size')}>
                Size {sortKey === 'size' && (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
              </button>
            </div>
            {messages.map(m => (
              <EmailRow
                key={m.id}
                message={m}
                selected={gmailSelectedIds.has(m.id)}
                onToggle={toggleEmailSelection}
              />
            ))}
          </div>

          {gmailResult.nextPageToken && (
            <button className="load-more-btn" onClick={loadMoreGmail} disabled={gmailLoading}>
              {gmailLoading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}

      {gmailSelectedIds.size > 0 && (
        <div className="email-actions-bar">
          <span>{gmailSelectedIds.size} selected</span>
          <button className="action-danger" onClick={trashSelected}>
            <Trash2 size={15} />
            Move {gmailSelectedIds.size} to Trash
          </button>
        </div>
      )}
    </div>
  );
}
