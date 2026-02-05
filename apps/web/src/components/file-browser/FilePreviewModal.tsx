import { useEffect, useRef, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

type PreviewType = 'text' | 'code' | 'image' | 'unsupported';

interface FilePreviewModalProps {
  file: {
    path: string;
    mimeType: string;
    content?: string;
    blobUrl?: string;
  } | null;
  onClose: () => void;
  onDownload?: () => void;
}

const CODE_EXTENSIONS: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  json: 'json',
  xml: 'xml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  sql: 'sql',
  md: 'markdown',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  prisma: 'prisma',
};

function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

function getPreviewType(mimeType: string, path: string): PreviewType {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  const ext = getFileExtension(path);
  if (CODE_EXTENSIONS[ext]) {
    return 'code';
  }

  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/xml'
  ) {
    return 'text';
  }

  return 'unsupported';
}

function getLanguage(path: string): string | undefined {
  const ext = getFileExtension(path);
  return CODE_EXTENSIONS[ext];
}

export function FilePreviewModal({ file, onClose, onDownload }: FilePreviewModalProps) {
  const codeRef = useRef<HTMLElement>(null);
  const [highlighted, setHighlighted] = useState(false);

  useEffect(() => {
    if (file && codeRef.current && !highlighted) {
      hljs.highlightElement(codeRef.current);
      setHighlighted(true);
    }
  }, [file, highlighted]);

  useEffect(() => {
    setHighlighted(false);
  }, [file?.path]);

  if (!file) return null;

  const fileName = file.path.split('/').pop();
  const previewType = getPreviewType(file.mimeType, file.path);
  const language = getLanguage(file.path);

  const renderContent = () => {
    switch (previewType) {
      case 'image':
        return (
          <div className="flex items-center justify-center p-4 bg-gray-100 min-h-[300px]">
            {file.blobUrl ? (
              <img
                src={file.blobUrl}
                alt={fileName}
                className="max-w-full max-h-[60vh] object-contain"
              />
            ) : (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 size={20} className="animate-spin" />
                Loading image...
              </div>
            )}
          </div>
        );

      case 'code':
        return (
          <div className="overflow-auto flex-1 text-sm">
            <pre className="p-4 m-0">
              <code ref={codeRef} className={language ? `language-${language}` : ''}>
                {file.content || ''}
              </code>
            </pre>
          </div>
        );

      case 'text':
        return (
          <pre className="p-4 overflow-auto flex-1 text-sm bg-gray-50 whitespace-pre-wrap">
            {file.content || ''}
          </pre>
        );

      case 'unsupported':
        return (
          <div className="flex flex-col items-center justify-center p-8 text-gray-500 min-h-[200px]">
            <p className="mb-4">Preview not available for this file type.</p>
            <p className="text-sm text-gray-400">MIME type: {file.mimeType}</p>
            {onDownload && (
              <button
                onClick={onDownload}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Download size={16} />
                Download File
              </button>
            )}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold">{fileName}</h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {file.mimeType}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onDownload && previewType !== 'unsupported' && (
              <button
                onClick={onDownload}
                className="p-1 hover:bg-gray-100 rounded"
                title="Download"
              >
                <Download size={20} className="text-gray-500" />
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X size={20} />
            </button>
          </div>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}
