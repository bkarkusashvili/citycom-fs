import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fsApi } from '../services/api';
import type { FsNode } from '../types';

interface UseFileOperationsOptions {
  currentPath: string;
  onFolderCreated?: () => void;
  onDeleted?: () => void;
  onCopied?: () => void;
  onMoved?: () => void;
  onUploadError?: (error: Error) => void;
  onCopyError?: (error: Error) => void;
  onMoveError?: (error: Error) => void;
}

export function useFileOperations({
  currentPath,
  onFolderCreated,
  onDeleted,
  onCopied,
  onMoved,
  onUploadError,
  onCopyError,
  onMoveError,
}: UseFileOperationsOptions) {
  const queryClient = useQueryClient();

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => {
      const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
      return fsApi.createDirectory(path);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fs', 'list', currentPath] });
      onFolderCreated?.();
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
      onDeleted?.();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => fsApi.uploadFile(currentPath, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fs', 'list', currentPath] });
    },
    onError: (error: Error) => {
      console.error('Upload failed:', error);
      onUploadError?.(error);
    },
  });

  const copyMutation = useMutation({
    mutationFn: ({ item, destPath }: { item: FsNode; destPath: string }) => {
      if (item.mimeType === 'inode/directory') {
        return fsApi.copyDirectory(item.path, destPath);
      }
      return fsApi.copyFile(item.path, destPath);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fs', 'list'] });
      onCopied?.();
    },
    onError: (error: Error) => {
      console.error('Copy failed:', error);
      onCopyError?.(error);
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ item, destPath }: { item: FsNode; destPath: string }) => {
      if (item.mimeType === 'inode/directory') {
        return fsApi.moveDirectory(item.path, destPath);
      }
      return fsApi.moveFile(item.path, destPath);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fs', 'list'] });
      onMoved?.();
    },
    onError: (error: Error) => {
      console.error('Move failed:', error);
      onMoveError?.(error);
    },
  });

  return {
    createFolder: createFolderMutation.mutate,
    isCreatingFolder: createFolderMutation.isPending,
    deleteItems: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    uploadFile: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
    copyItem: copyMutation.mutate,
    isCopying: copyMutation.isPending,
    moveItem: moveMutation.mutate,
    isMoving: moveMutation.isPending,
  };
}
