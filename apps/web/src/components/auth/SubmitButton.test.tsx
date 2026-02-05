import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubmitButton } from './SubmitButton';

describe('SubmitButton', () => {
  it('should render button text when not loading', () => {
    render(<SubmitButton isLoading={false} loadingText="Loading..." text="Submit" />);
    expect(screen.getByRole('button')).toHaveTextContent('Submit');
  });

  it('should render loading text when loading', () => {
    render(<SubmitButton isLoading={true} loadingText="Loading..." text="Submit" />);
    expect(screen.getByRole('button')).toHaveTextContent('Loading...');
  });

  it('should be disabled when loading', () => {
    render(<SubmitButton isLoading={true} loadingText="Loading..." text="Submit" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should not be disabled when not loading', () => {
    render(<SubmitButton isLoading={false} loadingText="Loading..." text="Submit" />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('should have type submit', () => {
    render(<SubmitButton isLoading={false} loadingText="Loading..." text="Submit" />);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });
});
