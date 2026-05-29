interface Props {
  message: string;
}

export default function LoadingScreen({ message }: Props) {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>{message}</p>
    </div>
  );
}
