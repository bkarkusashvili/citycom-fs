import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Folder,
  File,
  Upload,
  FolderPlus,
  Trash2,
  Download,
  ChevronRight,
  LogOut,
  Eye,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fsApi } from '../services/api';
import type { FsNode } from '../types';
import clsx from 'clsx';

function formatSize(bytes: number): string {
  if (bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FileBrowserPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [currentPath, setCurrentPath] = useState('/');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [previewFile, setPreviewFile] = useState<{ path: string; content: string } | null>(null);

  // Fetch directory contents
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['fs', 'list', currentPath],
    queryFn: () => fsApi.listDirectory(currentPath),
  });

  // Mutations
  const createFolderMutation = useMutation({
    mutationFn: (name: string) => {
      const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
      return fsApi.createDirectory(path);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fs', 'list', currentPath] });
      setIsNewFolderModalOpen(false);
      setNewFolderName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (items: FsNode[]) => {
      for (const item of items) {
        if (item.mimeType === 'inode/directory') {
          await fsApi.deleteDirectory(item.path);
        } else {
          await fsApi.deleteFile(item.path);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fs', 'list', currentPath] });
      setSelectedItems(new Set());
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => fsApi.uploadFile(currentPath, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fs', 'list', currentPath] });
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      alert('Upload failed. Check console for details.');
    },
  });

  // Handlers
  const navigateToFolder = (path: string) => {
    setCurrentPath(path);
    setSelectedItems(new Set());
  };

  const handleItemClick = (item: FsNode) => {
    if (item.mimeType === 'inode/directory') {
      navigateToFolder(item.path);
    } else {
      // Toggle selection
      const newSelected = new Set(selectedItems);
      if (newSelected.has(item.path)) {
        newSelected.delete(item.path);
      } else {
        newSelected.add(item.path);
      }
      setSelectedItems(newSelected);
    }
  };

  const handleItemDoubleClick = async (item: FsNode) => {
    if (item.mimeType === 'inode/directory') {
      navigateToFolder(item.path);
    } else if (item.mimeType.startsWith('text/') || item.mimeType === 'application/json') {
      // Preview text files
      try {
        const content = await fsApi.readFile(item.path);
        setPreviewFile({ path: item.path, content });
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    }
  };

  const handleDownload = async (item: FsNode) => {
    try {
      const blob = await fsApi.downloadFile(item.path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        uploadMutation.mutate(file);
      });
    }
    e.target.value = '';
  }, [uploadMutation]);

  const handleDelete = () => {
    const itemsToDelete = items.filter((item) => selectedItems.has(item.path));
    if (itemsToDelete.length > 0) {
      if (confirm(`Delete ${itemsToDelete.length} item(s)?`)) {
        deleteMutation.mutate(itemsToDelete);
      }
    }
  };

  // Breadcrumb segments
  const pathSegments = currentPath.split('/').filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">File Manager</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Toolbar */}
        <div className="mb-4 flex items-center gap-2">
          <label className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
            <Upload size={16} />
            Upload
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setIsNewFolderModalOpen(true)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-2"
          >
            <FolderPlus size={16} />
            New Folder
          </button>

          {selectedItems.size > 0 && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded flex items-center gap-2"
            >
              <Trash2 size={16} />
              Delete ({selectedItems.size})
            </button>
          )}
        </div>

        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-1 text-sm">
          <button
            onClick={() => navigateToFolder('/')}
            className="text-blue-600 hover:underline"
          >
            Home
          </button>
          {pathSegments.map((segment, index) => {
            const path = '/' + pathSegments.slice(0, index + 1).join('/');
            return (
              <span key={path} className="flex items-center gap-1">
                <ChevronRight size={14} className="text-gray-400" />
                <button
                  onClick={() => navigateToFolder(path)}
                  className="text-blue-600 hover:underline"
                >
                  {segment}
                </button>
              </span>
            );
          })}
        </nav>

        {/* File list */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">Failed to load directory</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-gray-500">This folder is empty</div>
          ) : (
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
                  <tr
                    key={item.path}
                    onClick={() => handleItemClick(item)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    className={clsx(
                      'cursor-pointer hover:bg-gray-50',
                      selectedItems.has(item.path) && 'bg-blue-50',
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.mimeType === 'inode/directory' ? (
                          <Folder size={20} className="text-yellow-500" />
                        ) : (
                          <File size={20} className="text-gray-400" />
                        )}
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatSize(item.size)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(item.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.mimeType !== 'inode/directory' && (
                          <>
                            {(item.mimeType.startsWith('text/') || item.mimeType === 'application/json') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemDoubleClick(item);
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
                                handleDownload(item);
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
                            if (confirm(`Delete ${item.name}?`)) {
                              deleteMutation.mutate([item]);
                            }
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Delete"
                        >
                          <Trash2 size={16} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* New Folder Modal */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-3 py-2 border rounded-md mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsNewFolderModalOpen(false);
                  setNewFolderName('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => createFolderMutation.mutate(newFolderName)}
                disabled={!newFolderName.trim() || createFolderMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">{previewFile.path.split('/').pop()}</h3>
              <button onClick={() => setPreviewFile(null)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <pre className="p-4 overflow-auto flex-1 text-sm bg-gray-50">
              {previewFile.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
