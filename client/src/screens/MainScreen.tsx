import { ImageOff } from 'lucide-react';
import { useAppState } from '../state/useAppState';
import AccountSwitcher from '../components/AccountSwitcher';
import QuotaBar from '../components/QuotaBar';
import TrashBanner from '../components/TrashBanner';
import OwnerToggle from '../components/OwnerToggle';
import SortToggle from '../components/SortToggle';
import TreeView from '../components/TreeView/TreeView';
import Breakdown from '../components/FileTypeBreakdown/Breakdown';
import GmailSearch from '../components/GmailSearch/GmailSearch';

const PHOTOS_TOOLTIP =
  "Google retired the Photos Library API's full-library access on 31 March 2025. " +
  "Apps can no longer list or delete photos from your library, so this can't be shown here. " +
  'Open Google Photos to review and free up photo storage.';

export default function MainScreen() {
  const { scanResult, activeTab, setActiveTab } = useAppState();
  if (!scanResult) return null;

  return (
    <div className="main-screen">
      <header className="main-header">
        <h1 className="app-title">Drive List</h1>
        <div className="header-right">
          <a
            className="photos-notice"
            href="https://photos.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            title={PHOTOS_TOOLTIP}
          >
            <ImageOff size={14} />
            <span>Manage Photos storage ↗</span>
          </a>
          <AccountSwitcher />
          <QuotaBar quota={scanResult.quota} />
        </div>
      </header>

      {scanResult.trashSizeBytes > 0 && (
        <TrashBanner bytes={scanResult.trashSizeBytes} />
      )}

      <div className="tab-bar">
        <div className="tabs">
          <button
            className={`tab${activeTab === 'tree' ? ' tab-active' : ''}`}
            onClick={() => setActiveTab('tree')}
          >
            Storage Tree
          </button>
          <button
            className={`tab${activeTab === 'breakdown' ? ' tab-active' : ''}`}
            onClick={() => setActiveTab('breakdown')}
          >
            File Types
          </button>
          <button
            className={`tab${activeTab === 'gmail' ? ' tab-active' : ''}`}
            onClick={() => setActiveTab('gmail')}
          >
            Gmail
          </button>
        </div>
        {activeTab === 'tree' && (
          <div className="tab-bar-controls">
            <SortToggle />
            <OwnerToggle />
          </div>
        )}
      </div>

      <div className="tab-content">
        {activeTab === 'tree' && <TreeView />}
        {activeTab === 'breakdown' && <Breakdown />}
        {activeTab === 'gmail' && <GmailSearch />}
      </div>
    </div>
  );
}
