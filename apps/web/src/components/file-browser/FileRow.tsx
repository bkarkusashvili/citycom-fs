import { Folder, File, Eye, Download, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { FsNode } from '../../types';
import { formatSize, formatDate } from '../../utils/format';

interface FileRowProps {
  item: FsNode;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

export function FileRow({
  item,
  isSelected,
  onClick,
  onDoubleClick,
  onPreview,
  onDownload,
  onDelete,
}: FileRowProps) {
  const isDirectory = item.mimeType === 'inode/directory';
  const isPreviewable = item.mimeType.startsWith('text/') || item.mimeType === 'application/json';

  return (
    <tr
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={clsx(
        'cursor-pointer hover:bg-gray-50',
        isSelected && 'bg-blue-50'
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isDirectory ? (
            <Folder size={20} className="text-yellow-500" />
          ) : (
            <File size={20} className="text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-900">{item.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{formatSize(item.size)}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(item.updatedAt)}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {!isDirectory && (
            <>
              {isPreviewable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreview();
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="Preview"
                >
                  <Eye size={16} className="text-gray-500" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
                className="p-1 hover:bg-gray-100 rounded"
                title="Download"
              >
                <Download size={16} className="text-gray-500" />
              </button>
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="Delete"
          >
            <Trash2 size={16} className="text-red-500" />
          </button>
        </div>
      </td>
    </tr>
  );
}
