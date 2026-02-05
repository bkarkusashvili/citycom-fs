import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Breadcrumb } from './Breadcrumb';

describe('Breadcrumb', () => {
  it('should render Home for root path', () => {
    render(<Breadcrumb currentPath="/" onNavigate={() => {}} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('should render path segments', () => {
    render(<Breadcrumb currentPath="/documents/work" onNavigate={() => {}} />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('documents')).toBeInTheDocument();
    expect(screen.getByText('work')).toBeInTheDocument();
  });

  it('should call onNavigate with root when Home is clicked', () => {
    const onNavigate = vi.fn();
    render(<Breadcrumb currentPath="/documents" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText('Home'));
    expect(onNavigate).toHaveBeenCalledWith('/');
  });

  it('should call onNavigate with correct path when segment is clicked', () => {
    const onNavigate = vi.fn();
    render(<Breadcrumb currentPath="/documents/work/projects" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText('documents'));
    expect(onNavigate).toHaveBeenCalledWith('/documents');

    fireEvent.click(screen.getByText('work'));
    expect(onNavigate).toHaveBeenCalledWith('/documents/work');
  });
});
