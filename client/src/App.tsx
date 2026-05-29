import { AppProvider, useAppState } from './state/useAppState';
import LoginScreen from './screens/LoginScreen';
import LoadingScreen from './screens/LoadingScreen';
import ErrorScreen from './screens/ErrorScreen';
import MainScreen from './screens/MainScreen';

function AppContent() {
  const { screen, errorMessage, retry, login } = useAppState();

  switch (screen) {
    case 'loading-auth':
      return <LoadingScreen message="Checking authentication…" />;
    case 'scanning':
      return <LoadingScreen message="Scanning your Drive, this may take a moment…" />;
    case 'login':
      return <LoginScreen onLogin={login} />;
    case 'error':
      return <ErrorScreen message={errorMessage} onRetry={retry} />;
    case 'main':
      return <MainScreen />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
