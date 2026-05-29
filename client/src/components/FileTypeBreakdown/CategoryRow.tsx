import { Film, Image, Music, FileText, Archive, LayoutGrid, File, ChevronRight } from 'lucide-react';
import { CategoryStat } from '../../types/drive';
import { formatSize } from '../../utils/formatSize';

const ICONS: Record<string, React.ReactNode> = {
  Video: <Film size={18} className="icon-video" />,
  Images: <Image size={18} className="icon-image" />,
  Audio: <Music size={18} className="icon-audio" />,
  Documents: <FileText size={18} className="icon-doc" />,
  Archives: <Archive size={18} className="icon-archive" />,
  'Google Workspace': <LayoutGrid size={18} className="icon-workspace" />,
  Other: <File size={18} className="icon-file" />,
};

interface Props {
  category: string;
  stat: CategoryStat;
  onClick: () => void;
}

export default function CategoryRow({ category, stat, onClick }: Props) {
  return (
    <div className="category-row" onClick={onClick} role="button">
      <span className="category-icon">{ICONS[category] ?? <File size={18} />}</span>
      <span className="category-name">{category}</span>
      <span className="category-count">{stat.fileCount.toLocaleString()} files</span>
      <span className="category-size">{formatSize(stat.totalBytes)}</span>
      <ChevronRight size={14} className="category-arrow" />
    </div>
  );
}
