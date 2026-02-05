import { Folder, File, Eye, Download, Trash2, Copy, Move, History } from 'lucide-react';
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
  onCopy: () => void;
  onMove: () => void;
  onVersions: () => void;
}

const PREVIEWABLE_EXTENSIONS = [
  'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp',
  'cs', 'php', 'swift', 'kt', 'scala', 'sh', 'bash', 'zsh', 'yml', 'yaml', 'json',
  'xml', 'html', 'css', 'scss', 'less', 'sql', 'md', 'dockerfile', 'makefile', 'prisma',
];

function isFilePreviewable(mimeType: string, name: string): boolean {
  // Images
  if (mimeType.startsWith('image/')) return true;
  // PDFs
  if (mimeType === 'application/pdf') return true;
  // Text files
  if (mimeType.startsWith('text/')) return true;
  // JSON, JS, XML
  if (['application/json', 'application/javascript', 'application/xml', 'application/typescript'].includes(mimeType)) return true;
  // Check by extension
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return PREVIEWABLE_EXTENSIONS.includes(ext);
}

export function FileRow({
  item,
  isSelected,
  onClick,
  onDoubleClick,
  onPreview,
  onDownload,
  onDelete,
  onCopy,
  onMove,
  onVersions,
}: FileRowProps) {
  const isDirectory = item.mimeType === 'inode/directory';
  const isPreviewable = isFilePreviewable(item.mimeType, item.name);

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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onVersions();
                }}
                className="p-1 hover:bg-gray-100 rounded"
                title="Version History"
              >
                <History size={16} className="text-blue-500" />
              </button>
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="Copy to..."
          >
            <Copy size={16} className="text-gray-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove();
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="Move to..."
          >
            <Move size={16} className="text-gray-500" />
          </button>
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
