import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorAlert } from './ErrorAlert';

describe('ErrorAlert', () => {
  it('should render nothing when message is null', () => {
    const { container } = render(<ErrorAlert message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render nothing when message is empty string', () => {
    const { container } = render(<ErrorAlert message="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render error message', () => {
    render(<ErrorAlert message="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should have error styling', () => {
    render(<ErrorAlert message="Error" />);
    const alert = screen.getByText('Error');
    expect(alert).toHaveClass('bg-red-50', 'text-red-600');
  });
});
