import { ChevronRight } from 'lucide-react';

interface BreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Breadcrumb({ currentPath, onNavigate }: BreadcrumbProps) {
  const pathSegments = currentPath.split('/').filter(Boolean);

  return (
    <nav className="mb-4 flex items-center gap-1 text-sm">
      <button
        onClick={() => onNavigate('/')}
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
              onClick={() => onNavigate(path)}
              className="text-blue-600 hover:underline"
            >
              {segment}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
