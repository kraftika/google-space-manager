import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react';
import { AuthStatus, DriveNode, ScanResult } from '../types/drive';
import { GmailSearchResult } from '../types/gmail';
import * as api from '../api/client';

type Screen = 'loading-auth' | 'login' | 'scanning' | 'main' | 'error';
type OwnerFilter = 'owned' | 'all';
type ActiveTab = 'tree' | 'breakdown' | 'gmail';
export type SortOption = 'size-desc' | 'size-asc' | 'name-asc' | 'name-desc';

interface AppData {
  screen: Screen;
  authStatus: AuthStatus | null;
  scanResult: ScanResult | null;
  errorMessage: string;
  ownerFilter: OwnerFilter;
  activeTab: ActiveTab;
  sortOption: SortOption;
  // Gmail
  gmailResult: GmailSearchResult | null;
  gmailLoading: boolean;
  gmailSelectedIds: Set<string>;
  gmailScopeError: boolean;
}

type Action =
  | { type: 'AUTH_LOADED'; authStatus: AuthStatus }
  | { type: 'SCAN_STARTED' }
  | { type: 'SCAN_DONE'; scanResult: ScanResult }
  | { type: 'ERROR'; message: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_OWNER_FILTER'; filter: OwnerFilter }
  | { type: 'SET_ACTIVE_TAB'; tab: ActiveTab }
  | { type: 'SET_SORT_OPTION'; option: SortOption }
  // Gmail
  | { type: 'GMAIL_LOADING' }
  | { type: 'GMAIL_RESULT'; result: GmailSearchResult; append: boolean }
  | { type: 'GMAIL_SCOPE_ERROR' }
  | { type: 'GMAIL_ERROR' }
  | { type: 'GMAIL_TOGGLE'; id: string }
  | { type: 'GMAIL_SELECT_ALL' }
  | { type: 'GMAIL_CLEAR_SELECTION' }
  | { type: 'GMAIL_REMOVE_IDS'; ids: string[] }
  | { type: 'RESET_MEDIA' };

const mediaInitial = {
  gmailResult: null,
  gmailLoading: false,
  gmailSelectedIds: new Set<string>(),
  gmailScopeError: false,
};

const initial: AppData = {
  screen: 'loading-auth',
  authStatus: null,
  scanResult: null,
  errorMessage: '',
  ownerFilter: 'all',
  activeTab: 'tree',
  sortOption: 'size-desc',
  ...mediaInitial,
};

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'AUTH_LOADED':
      return {
        ...state,
        authStatus: action.authStatus,
        screen: action.authStatus.authenticated ? 'scanning' : 'login',
      };
    case 'SCAN_STARTED':
      return { ...state, screen: 'scanning' };
    case 'SCAN_DONE':
      return { ...state, screen: 'main', scanResult: action.scanResult };
    case 'ERROR':
      return { ...state, screen: 'error', errorMessage: action.message };
    case 'LOGOUT':
      return { ...initial, screen: 'login' };
    case 'SET_OWNER_FILTER':
      return { ...state, ownerFilter: action.filter };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab };
    case 'SET_SORT_OPTION':
      return { ...state, sortOption: action.option };

    // ── Gmail ──
    case 'GMAIL_LOADING':
      return { ...state, gmailLoading: true, gmailScopeError: false };
    case 'GMAIL_RESULT': {
      const messages = action.append && state.gmailResult
        ? [...state.gmailResult.messages, ...action.result.messages]
        : action.result.messages;
      return {
        ...state,
        gmailLoading: false,
        gmailResult: { ...action.result, messages },
        gmailSelectedIds: action.append ? state.gmailSelectedIds : new Set(),
      };
    }
    case 'GMAIL_SCOPE_ERROR':
      return { ...state, gmailLoading: false, gmailScopeError: true };
    case 'GMAIL_ERROR':
      return { ...state, gmailLoading: false };
    case 'GMAIL_TOGGLE': {
      const next = new Set(state.gmailSelectedIds);
      if (next.has(action.id)) next.delete(action.id); else next.add(action.id);
      return { ...state, gmailSelectedIds: next };
    }
    case 'GMAIL_SELECT_ALL': {
      const all = state.gmailResult?.messages.map(m => m.id) ?? [];
      const next = state.gmailSelectedIds.size === all.length
        ? new Set<string>()
        : new Set(all);
      return { ...state, gmailSelectedIds: next };
    }
    case 'GMAIL_CLEAR_SELECTION':
      return { ...state, gmailSelectedIds: new Set() };
    case 'GMAIL_REMOVE_IDS': {
      if (!state.gmailResult) return state;
      const remove = new Set(action.ids);
      return {
        ...state,
        gmailResult: {
          ...state.gmailResult,
          messages: state.gmailResult.messages.filter(m => !remove.has(m.id)),
        },
        gmailSelectedIds: new Set(),
      };
    }

    case 'RESET_MEDIA':
      return { ...state, ...mediaInitial, gmailSelectedIds: new Set() };
  }
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function hasOwnedDescendant(node: DriveNode): boolean {
  if (node.ownedByMe) return true;
  return node.children.some(hasOwnedDescendant);
}

function pruneAndRecompute(node: DriveNode): DriveNode {
  const children = node.children.filter(hasOwnedDescendant).map(pruneAndRecompute);
  const sizeBytes =
    node.mimeType === FOLDER_MIME
      ? children.reduce((s, c) => s + c.sizeBytes, 0)
      : node.sizeBytes;
  return { ...node, children, sizeBytes };
}

function sortNode(node: DriveNode, opt: SortOption): DriveNode {
  const children = [...node.children].sort((a, b) => {
    switch (opt) {
      case 'size-desc': return b.sizeBytes - a.sizeBytes;
      case 'size-asc':  return a.sizeBytes - b.sizeBytes;
      case 'name-asc':  return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
    }
  });
  return { ...node, children: children.map(c => sortNode(c, opt)) };
}

export interface AppContextValue {
  screen: Screen;
  authStatus: AuthStatus | null;
  scanResult: ScanResult | null;
  errorMessage: string;
  ownerFilter: OwnerFilter;
  activeTab: ActiveTab;
  sortOption: SortOption;
  filteredTree: DriveNode | null;
  login: () => void;
  logout: () => void;
  switchAccount: (sessionId: string) => void;
  removeAccount: (sessionId: string) => void;
  retry: () => void;
  setOwnerFilter: (filter: OwnerFilter) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setSortOption: (option: SortOption) => void;
  // Gmail
  gmailResult: GmailSearchResult | null;
  gmailLoading: boolean;
  gmailSelectedIds: Set<string>;
  gmailScopeError: boolean;
  searchGmail: (template: string) => void;
  loadMoreGmail: () => void;
  trashSelected: () => void;
  toggleEmailSelection: (id: string) => void;
  selectAllEmails: () => void;
  clearEmailSelection: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  const startScan = useCallback(async () => {
    dispatch({ type: 'SCAN_STARTED' });
    try {
      const scanResult = await api.scanDrive();
      dispatch({ type: 'SCAN_DONE', scanResult });
    } catch (e) {
      if (e instanceof api.ReauthError) { api.triggerLogin(); return; }
      dispatch({ type: 'ERROR', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const initAuth = useCallback(async () => {
    try {
      const authStatus = await api.getAuthStatus();
      dispatch({ type: 'AUTH_LOADED', authStatus });
      if (authStatus.authenticated) await startScan();
    } catch (e) {
      dispatch({ type: 'ERROR', message: e instanceof Error ? e.message : String(e) });
    }
  }, [startScan]);

  useEffect(() => { void initAuth(); }, [initAuth]);

  const login = useCallback(() => api.triggerLogin(), []);

  const logout = useCallback(async () => {
    await api.logout();
    dispatch({ type: 'LOGOUT' });
  }, []);

  const removeAccount = useCallback(async (sessionId: string) => {
    try {
      await api.removeAccount(sessionId);
      dispatch({ type: 'RESET_MEDIA' });
      const authStatus = await api.getAuthStatus();
      dispatch({ type: 'AUTH_LOADED', authStatus });
      if (authStatus.authenticated) await startScan();
    } catch (e) {
      dispatch({ type: 'ERROR', message: e instanceof Error ? e.message : String(e) });
    }
  }, [startScan]);

  const switchAccount = useCallback(async (sessionId: string) => {
    try {
      await api.switchAccount(sessionId);
      dispatch({ type: 'RESET_MEDIA' });
      const authStatus = await api.getAuthStatus();
      dispatch({ type: 'AUTH_LOADED', authStatus });
      await startScan();
    } catch (e) {
      dispatch({ type: 'ERROR', message: e instanceof Error ? e.message : String(e) });
    }
  }, [startScan]);

  const retry = useCallback(() => { void initAuth(); }, [initAuth]);

  const setOwnerFilter = useCallback((filter: OwnerFilter) => dispatch({ type: 'SET_OWNER_FILTER', filter }), []);
  const setActiveTab = useCallback((tab: ActiveTab) => dispatch({ type: 'SET_ACTIVE_TAB', tab }), []);
  const setSortOption = useCallback((option: SortOption) => dispatch({ type: 'SET_SORT_OPTION', option }), []);

  // ── Gmail actions ──

  const searchGmail = useCallback(async (template: string) => {
    dispatch({ type: 'GMAIL_LOADING' });
    try {
      const result = await api.searchGmail(template);
      dispatch({ type: 'GMAIL_RESULT', result, append: false });
    } catch (e) {
      if (e instanceof api.ReauthError) { api.triggerLogin(); return; }
      if (e instanceof api.ScopeError) dispatch({ type: 'GMAIL_SCOPE_ERROR' });
      else dispatch({ type: 'GMAIL_ERROR' });
    }
  }, []);

  const loadMoreGmail = useCallback(async () => {
    const current = state.gmailResult;
    if (!current?.nextPageToken) return;
    dispatch({ type: 'GMAIL_LOADING' });
    try {
      const result = await api.searchGmail(current.template, current.nextPageToken);
      dispatch({ type: 'GMAIL_RESULT', result, append: true });
    } catch (e) {
      if (e instanceof api.ReauthError) { api.triggerLogin(); return; }
      if (e instanceof api.ScopeError) dispatch({ type: 'GMAIL_SCOPE_ERROR' });
      else dispatch({ type: 'GMAIL_ERROR' });
    }
  }, [state.gmailResult]);

  const trashSelected = useCallback(async () => {
    const ids = [...state.gmailSelectedIds];
    if (ids.length === 0) return;
    try {
      await api.trashEmails(ids);
      dispatch({ type: 'GMAIL_REMOVE_IDS', ids });
    } catch (e) {
      if (e instanceof api.ReauthError) { api.triggerLogin(); return; }
      if (e instanceof api.ScopeError) dispatch({ type: 'GMAIL_SCOPE_ERROR' });
    }
  }, [state.gmailSelectedIds]);

  const toggleEmailSelection = useCallback((id: string) => dispatch({ type: 'GMAIL_TOGGLE', id }), []);
  const selectAllEmails = useCallback(() => dispatch({ type: 'GMAIL_SELECT_ALL' }), []);
  const clearEmailSelection = useCallback(() => dispatch({ type: 'GMAIL_CLEAR_SELECTION' }), []);

  const filteredTree = useMemo(() => {
    if (!state.scanResult) return null;
    const pruned =
      state.ownerFilter === 'all'
        ? state.scanResult.tree
        : pruneAndRecompute(state.scanResult.tree);
    return sortNode(pruned, state.sortOption);
  }, [state.scanResult, state.ownerFilter, state.sortOption]);

  const value: AppContextValue = {
    screen: state.screen,
    authStatus: state.authStatus,
    scanResult: state.scanResult,
    errorMessage: state.errorMessage,
    ownerFilter: state.ownerFilter,
    activeTab: state.activeTab,
    sortOption: state.sortOption,
    filteredTree,
    login,
    logout,
    switchAccount,
    removeAccount,
    retry,
    setOwnerFilter,
    setActiveTab,
    setSortOption,
    gmailResult: state.gmailResult,
    gmailLoading: state.gmailLoading,
    gmailSelectedIds: state.gmailSelectedIds,
    gmailScopeError: state.gmailScopeError,
    searchGmail,
    loadMoreGmail,
    trashSelected,
    toggleEmailSelection,
    selectAllEmails,
    clearEmailSelection,
  };

  return React.createElement(AppContext.Provider, { value }, children);
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
