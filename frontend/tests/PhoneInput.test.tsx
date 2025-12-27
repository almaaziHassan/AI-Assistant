import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhoneInput from '../src/components/PhoneInput';

describe('PhoneInput', () => {
  const mockOnChange = vi.fn();
  const mockOnBlur = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render country code dropdown', () => {
      render(<PhoneInput value="" onChange={mockOnChange} />);

      const dropdown = screen.getByRole('combobox');
      expect(dropdown).toBeInTheDocument();
    });

    it('should render phone number input', () => {
      render(<PhoneInput value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should display default country code (+92)', () => {
      render(<PhoneInput value="" onChange={mockOnChange} />);

      const dropdown = screen.getByRole('combobox');
      expect(dropdown).toHaveValue('+92');
    });

    it('should display custom default country code', () => {
      render(<PhoneInput value="" onChange={mockOnChange} defaultCountryCode="+1" />);

      const dropdown = screen.getByRole('combobox');
      expect(dropdown).toHaveValue('+1');
    });

    it('should show digit counter', () => {
      render(<PhoneInput value="" onChange={mockOnChange} />);

      expect(screen.getByText(/0\/10 digits/)).toBeInTheDocument();
    });

    it('should show example hint', () => {
      render(<PhoneInput value="" onChange={mockOnChange} />);

      expect(screen.getByText(/e\.g\./)).toBeInTheDocument();
    });
  });

  describe('Country Selection', () => {
    it('should list all supported countries', () => {
      render(<PhoneInput value="" onChange={mockOnChange} />);

      const dropdown = screen.getByRole('combobox');
      const options = dropdown.querySelectorAll('option');

      // Should have many countries
      expect(options.length).toBeGreaterThan(20);
    });

    it('should include Pakistan in options', () => {
      render(<PhoneInput value="" onChange={mockOnChange} />);

      expect(screen.getByText('+92 Pakistan')).toBeInTheDocument();
    });

    it('should include USA in options', () => {
      render(<PhoneInput value="" onChange={mockOnChange} />);

      expect(screen.getByText('+1 USA/Canada')).toBeInTheDocument();
    });

    it('should change digit requirements when country changes', async () => {
      const user = userEvent.setup();
      render(<PhoneInput value="" onChange={mockOnChange} />);

      const dropdown = screen.getByRole('combobox');

      // Select Singapore (+65) which has 8 digit requirement
      await user.selectOptions(dropdown, '+65');

      expect(screen.getByText(/0\/8 digits/)).toBeInTheDocument();
    });

    it('should clear number when country changes', async () => {
      const user = userEvent.setup();
      render(<PhoneInput value="+923001234567" onChange={mockOnChange} />);

      const dropdown = screen.getByRole('combobox');
      await user.selectOptions(dropdown, '+1');

      // Should call onChange with just the country code (or empty)
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Number Input', () => {
    it('should only allow digits', async () => {
      const user = userEvent.setup();
      render(<PhoneInput value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'abc123xyz456');

      // Should only contain digits
      expect(input).toHaveValue('123456');
    });

    it('should limit digits to country max length', async () => {
      const user = userEvent.setup();
      render(<PhoneInput value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');

      // Try to type 15 digits (Pakistan limit is 10)
      await user.type(input, '123456789012345');

      // Should be limited to 10 digits
      expect(input).toHaveValue('1234567890');
    });

    it('should update digit counter as user types', async () => {
      const user = userEvent.setup();
      render(<PhoneInput value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '12345');

      expect(screen.getByText(/5\/10 digits/)).toBeInTheDocument();
    });

    it('should show valid state when correct length', async () => {
      const user = userEvent.setup();
      render(<PhoneInput value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '3001234567'); // 10 digits for Pakistan

      const counter = screen.getByText(/10\/10 digits/);
      expect(counter).toHaveClass('valid');
    });

    it('should call onChange with full phone number', async () => {
      const user = userEvent.setup();
      render(<PhoneInput value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '3001234567');

      // Should be called with country code + number
      expect(mockOnChange).toHaveBeenLastCalledWith('+923001234567');
    });
  });

  describe('Parsing Initial Value', () => {
    it('should parse existing phone with +92', () => {
      render(<PhoneInput value="+923001234567" onChange={mockOnChange} />);

      const dropdown = screen.getByRole('combobox');
      const input = screen.getByRole('textbox');

      expect(dropdown).toHaveValue('+92');
      expect(input).toHaveValue('3001234567');
    });

    it('should parse existing phone with +1', () => {
      render(<PhoneInput value="+14155551234" onChange={mockOnChange} />);

      const dropdown = screen.getByRole('combobox');
      const input = screen.getByRole('textbox');

      expect(dropdown).toHaveValue('+1');
      expect(input).toHaveValue('4155551234');
    });

    it('should parse existing phone with +44 (UK)', () => {
      render(<PhoneInput value="+447911123456" onChange={mockOnChange} />);

      const dropdown = screen.getByRole('combobox');
      const input = screen.getByRole('textbox');

      expect(dropdown).toHaveValue('+44');
      expect(input).toHaveValue('7911123456');
    });

    it('should handle 3-digit country codes like +971 (UAE)', () => {
      render(<PhoneInput value="+971501234567" onChange={mockOnChange} />);

      const dropdown = screen.getByRole('combobox');
      const input = screen.getByRole('textbox');

      expect(dropdown).toHaveValue('+971');
      expect(input).toHaveValue('501234567');
    });
  });

  describe('Disabled State', () => {
    it('should disable dropdown when disabled', () => {
      render(<PhoneInput value="" onChange={mockOnChange} disabled />);

      const dropdown = screen.getByRole('combobox');
      expect(dropdown).toBeDisabled();
    });

    it('should disable input when disabled', () => {
      render(<PhoneInput value="" onChange={mockOnChange} disabled />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  describe('Error Display', () => {
    it('should display error message', () => {
      render(<PhoneInput value="" onChange={mockOnChange} error="Phone is required" />);

      expect(screen.getByText('Phone is required')).toBeInTheDocument();
    });

    it('should have error class on container', () => {
      render(<PhoneInput value="" onChange={mockOnChange} error="Invalid phone" />);

      expect(screen.getByText('Invalid phone')).toHaveClass('field-error');
    });
  });

  describe('onBlur Callback', () => {
    it('should call onBlur when input loses focus', async () => {
      const user = userEvent.setup();
      render(<PhoneInput value="" onChange={mockOnChange} onBlur={mockOnBlur} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.tab();

      expect(mockOnBlur).toHaveBeenCalled();
    });
  });

  describe('Digit Limits by Country', () => {
    it('Pakistan (+92) should allow exactly 10 digits', async () => {
      const user = userEvent.setup();
      render(<PhoneInput value="" onChange={mockOnChange} defaultCountryCode="+92" />);

      const input = screen.getByRole('textbox');
      await user.type(input, '30012345678901234'); // 17 digits

      expect(input).toHaveValue('3001234567'); // Limited to 10
    });

    it('USA (+1) should allow exactly 10 digits', async () => {
      const user = userEvent.setup();
      render(<PhoneInput value="" onChange={mockOnChange} defaultCountryCode="+1" />);

      const input = screen.getByRole('textbox');
      await user.type(input, '415555123456789'); // 15 digits

      expect(input).toHaveValue('4155551234'); // Limited to 10
    });

    it('Singapore (+65) should allow exactly 8 digits', async () => {
      const user = userEvent.setup();
      render(<PhoneInput value="" onChange={mockOnChange} defaultCountryCode="+65" />);

      const input = screen.getByRole('textbox');
      await user.type(input, '912345678901'); // 12 digits

      expect(input).toHaveValue('91234567'); // Limited to 8
    });

    it('Germany (+49) should allow up to 12 digits', async () => {
      const user = userEvent.setup();
      render(<PhoneInput value="" onChange={mockOnChange} defaultCountryCode="+49" />);

      const input = screen.getByRole('textbox');
      await user.type(input, '15112345678901'); // 14 digits

      expect(input).toHaveValue('151123456789'); // Limited to 12
    });
  });
});
