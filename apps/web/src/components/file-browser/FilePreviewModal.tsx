import { X } from 'lucide-react';

interface FilePreviewModalProps {
  file: { path: string; content: string } | null;
  onClose: () => void;
}

export function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  if (!file) return null;

  const fileName = file.path.split('/').pop();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{fileName}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>
        <pre className="p-4 overflow-auto flex-1 text-sm bg-gray-50">
          {file.content}
        </pre>
      </div>
    </div>
  );
}
