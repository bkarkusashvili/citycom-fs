import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fsApi } from '../services/api';
import type { FsNode } from '../types';

interface UseFileOperationsOptions {
  currentPath: string;
  onFolderCreated?: () => void;
  onDeleted?: () => void;
  onUploadError?: (error: Error) => void;
}

export function useFileOperations({
  currentPath,
  onFolderCreated,
  onDeleted,
  onUploadError,
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

  return {
    createFolder: createFolderMutation.mutate,
    isCreatingFolder: createFolderMutation.isPending,
    deleteItems: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    uploadFile: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
  };
}
