export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  sizeEstimate: number; // bytes
}

export interface GmailSearchResult {
  messages: GmailMessage[];
  nextPageToken?: string;
  template: string;
}

export interface GmailTemplate {
  label: string;
  query: string;
  group: string;
}

export type GmailTemplates = Record<string, GmailTemplate>;
