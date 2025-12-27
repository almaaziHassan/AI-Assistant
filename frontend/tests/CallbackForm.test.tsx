import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CallbackForm from '../src/components/CallbackForm';

describe('CallbackForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  const serverUrl = 'http://localhost:3000';

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  it('should render with header', () => {
    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Request a Callback')).toBeInTheDocument();
  });

  it('should have close button', () => {
    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const closeButton = screen.getByText('×');
    expect(closeButton).toBeInTheDocument();
  });

  it('should call onCancel when close button clicked', async () => {
    const user = userEvent.setup();

    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const closeButton = screen.getByText('×');
    await user.click(closeButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show intro text', () => {
    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/wellness specialists/)).toBeInTheDocument();
  });

  it('should have required name field', () => {
    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/Your Name/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument();
  });

  it('should have required phone field', () => {
    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/Phone Number/)).toBeInTheDocument();
  });

  it('should have optional email field', () => {
    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/Email/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
  });

  it('should have preferred time dropdown', () => {
    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Best Time to Call')).toBeInTheDocument();
    expect(screen.getByText('Select preferred time...')).toBeInTheDocument();
  });

  it('should show time options in dropdown', () => {
    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Morning (9am - 12pm)')).toBeInTheDocument();
    expect(screen.getByText('Afternoon (12pm - 5pm)')).toBeInTheDocument();
    expect(screen.getByText('Evening (5pm - 8pm)')).toBeInTheDocument();
    expect(screen.getByText('Anytime')).toBeInTheDocument();
  });

  it('should have concerns textarea', () => {
    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByPlaceholderText(/Tell us about your concerns/)).toBeInTheDocument();
  });

  it('should have submit button', () => {
    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Request Callback')).toBeInTheDocument();
  });
});

describe('CallbackForm Validation', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  const serverUrl = 'http://localhost:3000';

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  it('should show name validation error on blur', async () => {
    const user = userEvent.setup();

    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByPlaceholderText('Enter your name');
    await user.click(nameInput);
    await user.tab();

    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('should show name too short error', async () => {
    const user = userEvent.setup();

    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByPlaceholderText('Enter your name');
    await user.type(nameInput, 'A');
    await user.tab();

    expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
  });

  it('should not submit without phone number', async () => {
    const user = userEvent.setup();

    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Fill in name but not phone
    const nameInput = screen.getByPlaceholderText('Enter your name');
    await user.type(nameInput, 'John Doe');

    // Try to submit - should not call onSubmit since phone is empty
    const submitButton = screen.getByText('Request Callback');
    await user.click(submitButton);

    // onSubmit should not have been called without phone
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should accept valid phone number with correct length', async () => {
    const user = userEvent.setup();

    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Get the phone number input
    const phoneInputs = screen.getAllByRole('textbox');
    const phoneInput = phoneInputs.find(input => input.classList.contains('national-number-input'));

    // Type a valid 10-digit number for Pakistan
    await user.type(phoneInput!, '3001234567');

    // Should show valid digit counter
    expect(screen.getByText(/10\/10 digits/)).toBeInTheDocument();
  });

  it('should show email validation error for invalid email', async () => {
    const user = userEvent.setup();

    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const emailInput = screen.getByPlaceholderText('your@email.com');
    await user.type(emailInput, 'invalid-email');
    await user.tab();

    expect(screen.getByText(/valid email/)).toBeInTheDocument();
  });

  it('should clear errors on input change', async () => {
    const user = userEvent.setup();

    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByPlaceholderText('Enter your name');
    await user.click(nameInput);
    await user.tab();

    expect(screen.getByText('Name is required')).toBeInTheDocument();

    await user.type(nameInput, 'John');

    expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
  });
});

describe('CallbackForm Submission', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  const serverUrl = 'http://localhost:3000';

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  it('should not submit with empty fields', async () => {
    const user = userEvent.setup();

    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByText('Request Callback');
    await user.click(submitButton);

    expect(mockOnSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('should submit with valid data', async () => {
    const user = userEvent.setup();

    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByPlaceholderText('Enter your name');
    const phoneInputs = screen.getAllByRole('textbox');
    const phoneInput = phoneInputs.find(input => input.classList.contains('national-number-input'))!;

    await user.type(nameInput, 'John Doe');
    await user.type(phoneInput, '3001234567');

    const submitButton = screen.getByText('Request Callback');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        customerName: 'John Doe',
        customerPhone: '+923001234567',
        customerEmail: '',
        preferredTime: '',
        concerns: ''
      });
    });
  });

  it('should show submitting state', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByPlaceholderText('Enter your name');
    const phoneInputs = screen.getAllByRole('textbox');
    const phoneInput = phoneInputs.find(input => input.classList.contains('national-number-input'))!;

    await user.type(nameInput, 'John Doe');
    await user.type(phoneInput, '3001234567');

    const submitButton = screen.getByText('Request Callback');
    await user.click(submitButton);

    expect(screen.getByText('Submitting...')).toBeInTheDocument();
  });

  it('should show error on submission failure', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValue(new Error('Submission failed'));

    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByPlaceholderText('Enter your name');
    const phoneInputs = screen.getAllByRole('textbox');
    const phoneInput = phoneInputs.find(input => input.classList.contains('national-number-input'))!;

    await user.type(nameInput, 'John Doe');
    await user.type(phoneInput, '3001234567');

    const submitButton = screen.getByText('Request Callback');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to submit. Please try again.')).toBeInTheDocument();
    });
  });

  it('should submit with optional fields', async () => {
    const user = userEvent.setup();

    render(
      <CallbackForm
        serverUrl={serverUrl}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByPlaceholderText('Enter your name');
    const phoneInputs = screen.getAllByRole('textbox');
    const phoneInput = phoneInputs.find(input => input.classList.contains('national-number-input'))!;
    const emailInput = screen.getByPlaceholderText('your@email.com');
    const concernsInput = screen.getByPlaceholderText(/Tell us about your concerns/);

    await user.type(nameInput, 'John Doe');
    await user.type(phoneInput, '3001234567');
    await user.type(emailInput, 'john@example.com');
    await user.type(concernsInput, 'I have back pain');

    // Select preferred time (note: there are two comboboxes now - country selector and time selector)
    const selects = screen.getAllByRole('combobox');
    const timeSelect = selects.find(s => s.classList.contains('staff-select'))!;
    await user.selectOptions(timeSelect, 'morning');

    const submitButton = screen.getByText('Request Callback');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        customerName: 'John Doe',
        customerPhone: '+923001234567',
        customerEmail: 'john@example.com',
        preferredTime: 'morning',
        concerns: 'I have back pain'
      });
    });
  });
});
