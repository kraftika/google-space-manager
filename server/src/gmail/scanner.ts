import { gmail_v1, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  sizeEstimate: number;
}

export interface GmailSearchResult {
  messages: GmailMessage[];
  nextPageToken?: string;
  template: string;
}

export const TEMPLATES: Record<string, { label: string; query: string; group: string }> = {
  'large-1mb':   { label: 'Larger than 1 MB',  query: 'larger:1m',       group: 'By size' },
  'large-5mb':   { label: 'Larger than 5 MB',  query: 'larger:5m',       group: 'By size' },
  'large-10mb':  { label: 'Larger than 10 MB', query: 'larger:10m',      group: 'By size' },
  'large-50mb':  { label: 'Larger than 50 MB', query: 'larger:50m',      group: 'By size' },
  'old-1month':  { label: 'Older than 1 month',  query: 'older_than:1m', group: 'By age' },
  'old-6months': { label: 'Older than 6 months', query: 'older_than:6m', group: 'By age' },
  'old-1year':   { label: 'Older than 1 year',   query: 'older_than:1y', group: 'By age' },
  'old-2years':  { label: 'Older than 2 years',  query: 'older_than:2y', group: 'By age' },
};

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

export async function searchMessages(
  auth: OAuth2Client,
  template: string,
  pageToken?: string,
): Promise<GmailSearchResult> {
  const tmpl = TEMPLATES[template];
  if (!tmpl) throw new Error(`Unknown template: ${template}`);

  const gmail = google.gmail({ version: 'v1', auth });

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: tmpl.query,
    maxResults: 50,
    ...(pageToken ? { pageToken } : {}),
  });

  const ids = listRes.data.messages ?? [];
  const nextPageToken = listRes.data.nextPageToken ?? undefined;

  const messages: GmailMessage[] = await Promise.all(
    ids.map(async ({ id, threadId }) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      const headers = detail.data.payload?.headers;
      return {
        id: id!,
        threadId: threadId ?? '',
        from: headerValue(headers, 'From'),
        subject: headerValue(headers, 'Subject'),
        date: headerValue(headers, 'Date'),
        sizeEstimate: detail.data.sizeEstimate ?? 0,
      };
    }),
  );

  return { messages, nextPageToken, template };
}

export async function trashMessages(auth: OAuth2Client, messageIds: string[]): Promise<void> {
  const gmail = google.gmail({ version: 'v1', auth });
  for (const id of messageIds) {
    await gmail.users.messages.trash({ userId: 'me', id });
  }
}
