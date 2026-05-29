interface Props {
  message: string;
  onRetry: () => void;
}

export default function ErrorScreen({ message, onRetry }: Props) {
  return (
    <div className="error-screen">
      <div className="error-icon">⚠</div>
      <h2>Something went wrong</h2>
      <p className="error-message">{message}</p>
      <button className="btn-retry" onClick={onRetry}>Retry</button>
    </div>
  );
}
