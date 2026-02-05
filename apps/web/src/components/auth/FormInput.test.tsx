import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormInput } from './FormInput';

describe('FormInput', () => {
  it('should render label and input', () => {
    render(
      <FormInput
        id="email"
        label="Email address"
        type="email"
        value=""
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
  });

  it('should call onChange when value changes', () => {
    const onChange = vi.fn();
    render(
      <FormInput
        id="test"
        label="Test"
        type="text"
        value=""
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new value' } });
    expect(onChange).toHaveBeenCalledWith('new value');
  });

  it('should be required by default', () => {
    render(
      <FormInput
        id="test"
        label="Test"
        type="text"
        value=""
        onChange={() => {}}
      />
    );

    expect(screen.getByRole('textbox')).toBeRequired();
  });

  it('should support optional input', () => {
    render(
      <FormInput
        id="test"
        label="Test"
        type="text"
        value=""
        onChange={() => {}}
        required={false}
      />
    );

    expect(screen.getByRole('textbox')).not.toBeRequired();
  });

  it('should pass autoComplete attribute', () => {
    render(
      <FormInput
        id="email"
        label="Email"
        type="email"
        value=""
        onChange={() => {}}
        autoComplete="email"
      />
    );

    expect(screen.getByRole('textbox')).toHaveAttribute('autocomplete', 'email');
  });
});
