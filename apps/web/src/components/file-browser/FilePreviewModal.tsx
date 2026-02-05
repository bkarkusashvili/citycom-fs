import { useEffect, useRef, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import hljs from 'highlight.js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'highlight.js/styles/github.css';

type PreviewType = 'text' | 'code' | 'image' | 'markdown' | 'pdf' | 'unsupported';

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

  if (mimeType === 'application/pdf') {
    return 'pdf';
  }

  const ext = getFileExtension(path);

  // Markdown gets special rendering
  if (ext === 'md' || mimeType === 'text/markdown') {
    return 'markdown';
  }

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

      case 'markdown':
        return (
          <div className="overflow-auto flex-1 p-6 markdown-preview">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 pb-2 border-b">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-bold mt-6 mb-3 pb-1 border-b">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
                p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full border-collapse border border-gray-300 text-sm">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
                th: ({ children }) => <th className="border border-gray-300 px-3 py-2 text-left font-semibold">{children}</th>,
                td: ({ children }) => <td className="border border-gray-300 px-3 py-2">{children}</td>,
                code: ({ className, children }) => {
                  const isInline = !className;
                  if (isInline) {
                    return <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-red-600">{children}</code>;
                  }
                  return (
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-3 text-sm">
                      <code className="font-mono">{children}</code>
                    </pre>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-500 pl-4 my-3 italic text-gray-600">{children}</blockquote>
                ),
                hr: () => <hr className="my-6 border-gray-300" />,
                a: ({ href, children }) => (
                  <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
                ),
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              }}
            >
              {file.content || ''}
            </ReactMarkdown>
          </div>
        );

      case 'pdf':
        return (
          <div className="flex-1 bg-gray-100">
            {file.blobUrl ? (
              <iframe
                src={file.blobUrl}
                className="w-full h-full min-h-[500px]"
                title={fileName}
              />
            ) : (
              <div className="flex items-center justify-center h-full min-h-[300px] text-gray-500">
                <Loader2 size={20} className="animate-spin mr-2" />
                Loading PDF...
              </div>
            )}
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
