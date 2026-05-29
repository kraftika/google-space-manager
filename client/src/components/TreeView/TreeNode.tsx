import { useState } from 'react';
import {
  Folder, FolderOpen, File, Film, Image, Music, FileText,
  Archive, LayoutGrid, ChevronRight, ChevronDown,
} from 'lucide-react';
import { DriveNode } from '../../types/drive';
import { formatSize } from '../../utils/formatSize';
import SizeBar from './SizeBar';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function NodeIcon({ node, expanded }: { node: DriveNode; expanded: boolean }) {
  const { mimeType } = node;
  if (mimeType === FOLDER_MIME)
    return expanded
      ? <FolderOpen size={15} className="icon-folder" />
      : <Folder size={15} className="icon-folder" />;
  if (node.isGoogleWorkspace) return <LayoutGrid size={15} className="icon-workspace" />;
  if (mimeType.startsWith('video/')) return <Film size={15} className="icon-video" />;
  if (mimeType.startsWith('image/')) return <Image size={15} className="icon-image" />;
  if (mimeType.startsWith('audio/')) return <Music size={15} className="icon-audio" />;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('gzip'))
    return <Archive size={15} className="icon-archive" />;
  if (mimeType.startsWith('text/') || mimeType.includes('document') || mimeType === 'application/pdf')
    return <FileText size={15} className="icon-doc" />;
  return <File size={15} className="icon-file" />;
}

interface Props {
  node: DriveNode;
  parentMaxBytes: number;
  depth: number;
}

export default function TreeNode({ node, parentMaxBytes, depth }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isFolder = node.mimeType === FOLDER_MIME;
  const proportional = parentMaxBytes > 0 ? node.sizeBytes / parentMaxBytes : 0;
  const sizeLabel = node.isGoogleWorkspace ? '0 B†' : formatSize(node.sizeBytes);

  return (
    <div>
      <div
        className={`tree-row${isFolder ? ' tree-row-folder' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => isFolder && setExpanded(e => !e)}
      >
        <span className="tree-chevron">
          {isFolder
            ? expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />
            : <span className="tree-chevron-spacer" />}
        </span>
        <span className="tree-icon">
          <NodeIcon node={node} expanded={expanded} />
        </span>
        <span className="tree-name" title={node.name}>{node.name}</span>
        <SizeBar proportional={proportional} isFolder={isFolder} />
        <span className="tree-size-label">{sizeLabel}</span>
      </div>
      {expanded && isFolder && node.children.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          parentMaxBytes={node.sizeBytes || 1}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
