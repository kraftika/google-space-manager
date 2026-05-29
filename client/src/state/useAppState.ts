import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react';
import { AuthStatus, DriveNode, ScanResult } from '../types/drive';
import * as api from '../api/client';

type Screen = 'loading-auth' | 'login' | 'scanning' | 'main' | 'error';
type OwnerFilter = 'owned' | 'all';
type ActiveTab = 'tree' | 'breakdown';
export type SortOption = 'size-desc' | 'size-asc' | 'name-asc' | 'name-desc';

interface AppData {
  screen: Screen;
  authStatus: AuthStatus | null;
  scanResult: ScanResult | null;
  errorMessage: string;
  ownerFilter: OwnerFilter;
  activeTab: ActiveTab;
  sortOption: SortOption;
}

type Action =
  | { type: 'AUTH_LOADED'; authStatus: AuthStatus }
  | { type: 'SCAN_STARTED' }
  | { type: 'SCAN_DONE'; scanResult: ScanResult }
  | { type: 'ERROR'; message: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_OWNER_FILTER'; filter: OwnerFilter }
  | { type: 'SET_ACTIVE_TAB'; tab: ActiveTab }
  | { type: 'SET_SORT_OPTION'; option: SortOption };

const initial: AppData = {
  screen: 'loading-auth',
  authStatus: null,
  scanResult: null,
  errorMessage: '',
  ownerFilter: 'all',
  activeTab: 'tree',
  sortOption: 'size-desc',
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
  };

  return React.createElement(AppContext.Provider, { value }, children);
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
