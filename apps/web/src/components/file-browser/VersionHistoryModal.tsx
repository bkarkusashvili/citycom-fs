import { useState, useEffect } from 'react';
import { X, Download, RotateCcw, History, Check } from 'lucide-react';
import type { FileVersion, FsNode } from '../../types';
import { fsApi } from '../../services/api';
import { formatSize, formatDate } from '../../utils/format';

interface VersionHistoryModalProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
  onRestore: () => void;
}

interface DisplayVersion {
  id: string;
  version: number;
  size: number;
  date: string;
  isCurrent: boolean;
}

export function VersionHistoryModal({
  filePath,
  fileName,
  onClose,
  onRestore,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [currentFile, setCurrentFile] = useState<FsNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [filePath]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [versionsData, fileInfo] = await Promise.all([
        fsApi.listVersions(filePath),
        fsApi.getInfo(filePath),
      ]);
      setVersions(versionsData);
      setCurrentFile(fileInfo);
    } catch (err) {
      setError('Failed to load version history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (version: number, isCurrent: boolean = false) => {
    try {
      const blob = isCurrent
        ? await fsApi.downloadFile(filePath)
        : await fsApi.downloadVersion(filePath, version);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = isCurrent ? fileName : `${fileName}.v${version}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download version:', err);
    }
  };

  const handleRestore = async (version: number) => {
    if (!confirm(`Restore ${fileName} to version ${version}? The current version will be saved as a new version.`)) {
      return;
    }
    try {
      setRestoring(version);
      await fsApi.restoreVersion(filePath, version);
      onRestore();
      onClose();
    } catch (err) {
      console.error('Failed to restore version:', err);
      setError('Failed to restore version');
    } finally {
      setRestoring(null);
    }
  };

  // Build display list: current version first, then previous versions
  const displayVersions: DisplayVersion[] = [];

  // Current version (max version number + 1)
  const currentVersionNum = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;
  if (currentFile) {
    displayVersions.push({
      id: 'current',
      version: currentVersionNum,
      size: currentFile.size,
      date: currentFile.updatedAt,
      isCurrent: true,
    });
  }

  // Previous versions (sorted by version desc)
  versions.forEach(v => {
    displayVersions.push({
      id: v.id,
      version: v.version,
      size: v.size,
      date: v.createdAt,
      isCurrent: false,
    });
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <History size={20} className="text-blue-500" />
            <h2 className="text-lg font-semibold">Version History</h2>
            <span className="text-sm text-gray-500">- {fileName}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : displayVersions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History size={48} className="mx-auto mb-4 opacity-50" />
              <p>No versions available</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-2 font-medium">Version</th>
                  <th className="pb-2 font-medium">Size</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayVersions.map((v) => (
                  <tr
                    key={v.id}
                    className={`border-b last:border-b-0 ${v.isCurrent ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="py-3">
                      {v.isCurrent ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-800 text-sm font-medium">
                          <Check size={14} />
                          v{v.version} (Current)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-sm font-medium">
                          v{v.version}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-sm text-gray-600">{formatSize(v.size)}</td>
                    <td className="py-3 text-sm text-gray-600">{formatDate(v.date)}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(v.version, v.isCurrent)}
                          className={`p-1.5 rounded text-gray-600 ${v.isCurrent ? 'hover:bg-green-100' : 'hover:bg-gray-100'}`}
                          title="Download this version"
                        >
                          <Download size={16} />
                        </button>
                        {!v.isCurrent && (
                          <button
                            onClick={() => handleRestore(v.version)}
                            disabled={restoring !== null}
                            className="p-1.5 hover:bg-blue-100 rounded text-blue-600 disabled:opacity-50"
                            title="Restore this version"
                          >
                            {restoring === v.version ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                            ) : (
                              <RotateCcw size={16} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 text-sm text-gray-500">
          {displayVersions.length} version{displayVersions.length !== 1 ? 's' : ''} total
        </div>
      </div>
    </div>
  );
}
