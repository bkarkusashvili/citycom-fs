import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { fsApi } from '../services/api';
import { useFileOperations } from '../hooks/useFileOperations';
import {
  Breadcrumb,
  FilePreviewModal,
  FileTable,
  Header,
  NewFolderModal,
  Toolbar,
} from '../components/file-browser';
import type { FsNode } from '../types';

export default function FileBrowserPage() {
  const { user, logout } = useAuth();

  const [currentPath, setCurrentPath] = useState('/');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ path: string; content: string } | null>(null);

  // Fetch directory contents with pagination
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['fs', 'list', currentPath],
    queryFn: ({ pageParam }) =>
      fsApi.listDirectory(currentPath, { limit: 50, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
  });

  // Flatten paginated items
  const items: FsNode[] = data?.pages.flatMap((page) => page.items) ?? [];

  // File operations (mutations)
  const { createFolder, isCreatingFolder, deleteItems, uploadFile } = useFileOperations({
    currentPath,
    onFolderCreated: () => {
      setIsNewFolderModalOpen(false);
    },
    onDeleted: () => {
      setSelectedItems(new Set());
    },
    onUploadError: () => {
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

  const handleUpload = (files: FileList) => {
    Array.from(files).forEach((file) => {
      uploadFile(file);
    });
  };

  const handleDelete = () => {
    const itemsToDelete = items.filter((item) => selectedItems.has(item.path));
    if (itemsToDelete.length > 0 && confirm(`Delete ${itemsToDelete.length} item(s)?`)) {
      deleteItems(itemsToDelete);
    }
  };

  const handleDeleteSingle = (item: FsNode) => {
    if (confirm(`Delete ${item.name}?`)) {
      deleteItems([item]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userEmail={user?.email} onLogout={logout} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Toolbar
          selectedCount={selectedItems.size}
          onNewFolder={() => setIsNewFolderModalOpen(true)}
          onDelete={handleDelete}
          onUpload={handleUpload}
        />

        <Breadcrumb currentPath={currentPath} onNavigate={navigateToFolder} />

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <FileTable
            items={items}
            selectedItems={selectedItems}
            isLoading={isLoading}
            error={error}
            hasNextPage={hasNextPage ?? false}
            isFetchingNextPage={isFetchingNextPage}
            onItemClick={handleItemClick}
            onItemDoubleClick={handleItemDoubleClick}
            onPreview={handleItemDoubleClick}
            onDownload={handleDownload}
            onDelete={handleDeleteSingle}
            onLoadMore={fetchNextPage}
          />
        </div>
      </main>

      <NewFolderModal
        isOpen={isNewFolderModalOpen}
        isCreating={isCreatingFolder}
        onClose={() => setIsNewFolderModalOpen(false)}
        onCreate={createFolder}
      />

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}
