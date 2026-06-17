import { useEffect, useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useAppState } from '../../state/useAppState';
import { getGmailTemplates, triggerLogin } from '../../api/client';
import { GmailTemplates } from '../../types/gmail';
import EmailRow from './EmailRow';

export default function GmailSearch() {
  const {
    gmailResult, gmailLoading, gmailSelectedIds, gmailScopeError,
    searchGmail, loadMoreGmail, trashSelected,
    toggleEmailSelection, selectAllEmails,
  } = useAppState();

  const [templates, setTemplates] = useState<GmailTemplates>({});
  const [template, setTemplate] = useState('');

  useEffect(() => {
    getGmailTemplates().then(setTemplates).catch(() => setTemplates({}));
  }, []);

  const groups = Object.entries(templates).reduce<Record<string, [string, GmailTemplates[string]][]>>(
    (acc, entry) => {
      const group = entry[1].group;
      (acc[group] ??= []).push(entry);
      return acc;
    }, {},
  );

  const messages = gmailResult?.messages ?? [];
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
              <span className="email-from">From</span>
              <span className="email-subject">Subject</span>
              <span className="email-date">Date</span>
              <span className="email-size">Size</span>
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
