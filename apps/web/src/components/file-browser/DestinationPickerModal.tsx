import { useState, useEffect } from 'react';
import { X, Folder, ChevronRight, Home } from 'lucide-react';
import { fsApi } from '../../services/api';
import type { FsNode } from '../../types';

interface DestinationPickerModalProps {
  isOpen: boolean;
  title: string;
  actionLabel: string;
  isLoading: boolean;
  excludePath?: string;
  onClose: () => void;
  onSelect: (destPath: string) => void;
}

export function DestinationPickerModal({
  isOpen,
  title,
  actionLabel,
  isLoading,
  excludePath,
  onClose,
  onSelect,
}: DestinationPickerModalProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [folders, setFolders] = useState<FsNode[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchFolders(currentPath);
    }
  }, [isOpen, currentPath]);

  const fetchFolders = async (path: string) => {
    setIsFetching(true);
    try {
      const response = await fsApi.listDirectory(path, { limit: 100 });
      const dirs = response.items.filter(
        (item) =>
          item.mimeType === 'inode/directory' &&
          item.path !== excludePath &&
          !item.path.startsWith(excludePath + '/')
      );
      setFolders(dirs);
    } catch (err) {
      console.error('Failed to fetch folders:', err);
      setFolders([]);
    } finally {
      setIsFetching(false);
    }
  };

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const handleSelect = () => {
    onSelect(currentPath);
  };

  const pathSegments = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
            disabled={isLoading}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm mb-3 flex-wrap">
            <button
              onClick={() => handleNavigate('/')}
              className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded text-blue-600"
            >
              <Home size={14} />
              <span>Home</span>
            </button>
            {pathSegments.map((segment, index) => {
              const segmentPath = '/' + pathSegments.slice(0, index + 1).join('/');
              return (
                <span key={segmentPath} className="flex items-center gap-1">
                  <ChevronRight size={14} className="text-gray-400" />
                  <button
                    onClick={() => handleNavigate(segmentPath)}
                    className="px-2 py-1 hover:bg-gray-100 rounded text-blue-600"
                  >
                    {segment}
                  </button>
                </span>
              );
            })}
          </div>

          {/* Selected destination */}
          <div className="mb-3 p-2 bg-blue-50 rounded text-sm">
            <span className="text-gray-600">Destination: </span>
            <span className="font-medium text-blue-700">{currentPath}</span>
          </div>

          {/* Folder list */}
          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {isFetching ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : folders.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No subfolders</div>
            ) : (
              <ul className="divide-y">
                {folders.map((folder) => (
                  <li key={folder.path}>
                    <button
                      onClick={() => handleNavigate(folder.path)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                    >
                      <Folder size={18} className="text-yellow-500" />
                      <span className="text-sm text-gray-700">{folder.name}</span>
                      <ChevronRight size={16} className="text-gray-400 ml-auto" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
