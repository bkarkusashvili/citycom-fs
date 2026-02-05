import { Loader2 } from 'lucide-react';
import type { FsNode } from '../../types';
import { FileRow } from './FileRow';

interface FileTableProps {
  items: FsNode[];
  selectedItems: Set<string>;
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onItemClick: (item: FsNode) => void;
  onItemDoubleClick: (item: FsNode) => void;
  onPreview: (item: FsNode) => void;
  onDownload: (item: FsNode) => void;
  onDelete: (item: FsNode) => void;
  onCopy: (item: FsNode) => void;
  onMove: (item: FsNode) => void;
  onVersions: (item: FsNode) => void;
  onLoadMore: () => void;
}

export function FileTable({
  items,
  selectedItems,
  isLoading,
  error,
  hasNextPage,
  isFetchingNextPage,
  onItemClick,
  onItemDoubleClick,
  onPreview,
  onDownload,
  onDelete,
  onCopy,
  onMove,
  onVersions,
  onLoadMore,
}: FileTableProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">Failed to load directory</div>;
  }

  if (items.length === 0) {
    return <div className="p-8 text-center text-gray-500">This folder is empty</div>;
  }

  return (
    <>
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Name</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Size</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Modified</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <FileRow
              key={item.path}
              item={item}
              isSelected={selectedItems.has(item.path)}
              onClick={() => onItemClick(item)}
              onDoubleClick={() => onItemDoubleClick(item)}
              onPreview={() => onPreview(item)}
              onDownload={() => onDownload(item)}
              onDelete={() => onDelete(item)}
              onCopy={() => onCopy(item)}
              onMove={() => onMove(item)}
              onVersions={() => onVersions(item)}
            />
          ))}
        </tbody>
      </table>
      {hasNextPage && (
        <div className="p-4 border-t text-center">
          <button
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </>
  );
}
