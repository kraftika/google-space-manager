interface Props {
  proportional: number;
  isFolder: boolean;
}

const MAX_WIDTH = 200;

export default function SizeBar({ proportional, isFolder }: Props) {
  const width = Math.max(2, proportional * MAX_WIDTH);
  return (
    <div className="size-bar-track">
      <div
        className="size-bar-fill"
        style={{
          width,
          backgroundColor: isFolder ? '#3b82f6' : '#14b8a6',
        }}
      />
    </div>
  );
}
