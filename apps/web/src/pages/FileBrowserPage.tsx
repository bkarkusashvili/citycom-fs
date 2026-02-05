import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { fsApi } from '../services/api';
import { useFileOperations } from '../hooks/useFileOperations';
import {
  Breadcrumb,
  DestinationPickerModal,
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
  const [previewFile, setPreviewFile] = useState<{
    path: string;
    mimeType: string;
    content?: string;
    blobUrl?: string;
  } | null>(null);
  const [copyMoveModal, setCopyMoveModal] = useState<{
    isOpen: boolean;
    mode: 'copy' | 'move';
    item: FsNode | null;
  }>({ isOpen: false, mode: 'copy', item: null });

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
  const {
    createFolder,
    isCreatingFolder,
    deleteItems,
    uploadFile,
    copyItem,
    isCopying,
    moveItem,
    isMoving,
  } = useFileOperations({
    currentPath,
    onFolderCreated: () => {
      setIsNewFolderModalOpen(false);
    },
    onDeleted: () => {
      setSelectedItems(new Set());
    },
    onCopied: () => {
      setCopyMoveModal({ isOpen: false, mode: 'copy', item: null });
    },
    onMoved: () => {
      setCopyMoveModal({ isOpen: false, mode: 'move', item: null });
    },
    onUploadError: () => {
      alert('Upload failed. Check console for details.');
    },
    onCopyError: () => {
      alert('Copy failed. Check console for details.');
    },
    onMoveError: () => {
      alert('Move failed. Check console for details.');
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
      return;
    }

    // Binary files that need blob URL (images, PDFs)
    if (item.mimeType.startsWith('image/') || item.mimeType === 'application/pdf') {
      try {
        const blob = await fsApi.downloadFile(item.path);
        const blobUrl = URL.createObjectURL(blob);
        setPreviewFile({ path: item.path, mimeType: item.mimeType, blobUrl });
      } catch (err) {
        console.error('Failed to load file:', err);
      }
      return;
    }

    // Check if file is text-based (by mime or extension)
    const ext = item.name.split('.').pop()?.toLowerCase() || '';
    const textExtensions = [
      'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp',
      'cs', 'php', 'swift', 'kt', 'scala', 'sh', 'bash', 'zsh', 'yml', 'yaml', 'json',
      'xml', 'html', 'css', 'scss', 'less', 'sql', 'md', 'dockerfile', 'makefile', 'prisma',
      'txt', 'log', 'env', 'gitignore', 'dockerignore',
    ];

    const isTextFile =
      item.mimeType.startsWith('text/') ||
      item.mimeType === 'application/json' ||
      item.mimeType === 'application/javascript' ||
      item.mimeType === 'application/xml' ||
      item.mimeType === 'application/typescript' ||
      textExtensions.includes(ext);

    if (isTextFile) {
      try {
        const content = await fsApi.readFile(item.path);
        setPreviewFile({ path: item.path, mimeType: item.mimeType, content });
      } catch (err) {
        console.error('Failed to read file:', err);
      }
      return;
    }

    // Unsupported type - show preview modal with download option
    setPreviewFile({ path: item.path, mimeType: item.mimeType });
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

  const handleCopy = (item: FsNode) => {
    setCopyMoveModal({ isOpen: true, mode: 'copy', item });
  };

  const handleMove = (item: FsNode) => {
    setCopyMoveModal({ isOpen: true, mode: 'move', item });
  };

  const handleCopyMoveConfirm = (destPath: string) => {
    if (!copyMoveModal.item) return;
    const destFullPath =
      destPath === '/'
        ? `/${copyMoveModal.item.name}`
        : `${destPath}/${copyMoveModal.item.name}`;

    if (copyMoveModal.mode === 'copy') {
      copyItem({ item: copyMoveModal.item, destPath: destFullPath });
    } else {
      moveItem({ item: copyMoveModal.item, destPath: destFullPath });
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
            onCopy={handleCopy}
            onMove={handleMove}
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

      <FilePreviewModal
        file={previewFile}
        onClose={() => {
          if (previewFile?.blobUrl) {
            URL.revokeObjectURL(previewFile.blobUrl);
          }
          setPreviewFile(null);
        }}
        onDownload={previewFile ? () => {
          const item = items.find(i => i.path === previewFile.path);
          if (item) handleDownload(item);
        } : undefined}
      />

      <DestinationPickerModal
        isOpen={copyMoveModal.isOpen}
        title={copyMoveModal.mode === 'copy' ? 'Copy to...' : 'Move to...'}
        actionLabel={copyMoveModal.mode === 'copy' ? 'Copy Here' : 'Move Here'}
        isLoading={isCopying || isMoving}
        excludePath={copyMoveModal.item?.path}
        onClose={() => setCopyMoveModal({ isOpen: false, mode: 'copy', item: null })}
        onSelect={handleCopyMoveConfirm}
      />
    </div>
  );
}
