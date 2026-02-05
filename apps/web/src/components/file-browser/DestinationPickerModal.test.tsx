import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DestinationPickerModal } from './DestinationPickerModal';
import { fsApi } from '../../services/api';

vi.mock('../../services/api', () => ({
  fsApi: {
    listDirectory: vi.fn(),
  },
}));

describe('DestinationPickerModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (fsApi.listDirectory as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [
        { name: 'folder1', path: '/folder1', mimeType: 'inode/directory', size: 0, createdAt: '', updatedAt: '', ownerId: '' },
        { name: 'folder2', path: '/folder2', mimeType: 'inode/directory', size: 0, createdAt: '', updatedAt: '', ownerId: '' },
      ],
      hasMore: false,
    });
  });

  it('should not render when closed', () => {
    render(
      <DestinationPickerModal
        isOpen={false}
        title="Copy to..."
        actionLabel="Copy Here"
        isLoading={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.queryByText('Copy to...')).not.toBeInTheDocument();
  });

  it('should render title and action button when open', async () => {
    render(
      <DestinationPickerModal
        isOpen={true}
        title="Copy to..."
        actionLabel="Copy Here"
        isLoading={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('Copy to...')).toBeInTheDocument();
    expect(screen.getByText('Copy Here')).toBeInTheDocument();
  });

  it('should show folders from API', async () => {
    render(
      <DestinationPickerModal
        isOpen={true}
        title="Copy to..."
        actionLabel="Copy Here"
        isLoading={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('folder1')).toBeInTheDocument();
      expect(screen.getByText('folder2')).toBeInTheDocument();
    });
  });

  it('should show current destination path', async () => {
    render(
      <DestinationPickerModal
        isOpen={true}
        title="Copy to..."
        actionLabel="Copy Here"
        isLoading={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('Destination:')).toBeInTheDocument();
  });

  it('should call onClose when Cancel is clicked', () => {
    render(
      <DestinationPickerModal
        isOpen={true}
        title="Copy to..."
        actionLabel="Copy Here"
        isLoading={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onSelect with current path when action button clicked', () => {
    render(
      <DestinationPickerModal
        isOpen={true}
        title="Copy to..."
        actionLabel="Copy Here"
        isLoading={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    fireEvent.click(screen.getByText('Copy Here'));
    expect(mockOnSelect).toHaveBeenCalledWith('/');
  });

  it('should show loading state', () => {
    render(
      <DestinationPickerModal
        isOpen={true}
        title="Move to..."
        actionLabel="Move Here"
        isLoading={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('should exclude specified path from folder list', async () => {
    (fsApi.listDirectory as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [
        { name: 'folder1', path: '/folder1', mimeType: 'inode/directory', size: 0, createdAt: '', updatedAt: '', ownerId: '' },
        { name: 'exclude', path: '/exclude', mimeType: 'inode/directory', size: 0, createdAt: '', updatedAt: '', ownerId: '' },
      ],
      hasMore: false,
    });

    render(
      <DestinationPickerModal
        isOpen={true}
        title="Move to..."
        actionLabel="Move Here"
        isLoading={false}
        excludePath="/exclude"
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('folder1')).toBeInTheDocument();
      expect(screen.queryByText('exclude')).not.toBeInTheDocument();
    });
  });
});
