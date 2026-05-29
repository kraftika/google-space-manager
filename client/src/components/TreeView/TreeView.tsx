import { useAppState } from '../../state/useAppState';
import TreeNode from './TreeNode';

export default function TreeView() {
  const { filteredTree } = useAppState();
  if (!filteredTree) return null;

  const hasWorkspace = filteredTree.children.some(
    n => n.isGoogleWorkspace || n.children.some(c => c.isGoogleWorkspace),
  );

  return (
    <div className="tree-view">
      {filteredTree.children.map(node => (
        <TreeNode
          key={node.id}
          node={node}
          parentMaxBytes={filteredTree.sizeBytes || 1}
          depth={0}
        />
      ))}
      {hasWorkspace && (
        <p className="tree-footnote">
          † Google Docs, Sheets, and Slides are stored in Google's format and don't count toward your quota.
        </p>
      )}
    </div>
  );
}
