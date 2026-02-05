import { Upload, FolderPlus, Trash2 } from 'lucide-react';
import { useCallback } from 'react';

interface ToolbarProps {
  selectedCount: number;
  onNewFolder: () => void;
  onDelete: () => void;
  onUpload: (files: FileList) => void;
}

export function Toolbar({ selectedCount, onNewFolder, onDelete, onUpload }: ToolbarProps) {
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onUpload(files);
      }
      e.target.value = '';
    },
    [onUpload]
  );

  return (
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
        onClick={onNewFolder}
        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-2"
      >
        <FolderPlus size={16} />
        New Folder
      </button>

      {selectedCount > 0 && (
        <button
          onClick={onDelete}
          className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded flex items-center gap-2"
        >
          <Trash2 size={16} />
          Delete ({selectedCount})
        </button>
      )}
    </div>
  );
}
