import React, { useState } from 'react';
import { validatePhoneNumber, validateEmail } from '../utils/validation';

interface CallbackData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  preferredTime: string;
  concerns: string;
}

interface CallbackFormProps {
  serverUrl: string;
  onSubmit: (data: CallbackData) => Promise<void>;
  onCancel: () => void;
}

const CallbackForm: React.FC<CallbackFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<CallbackData>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    preferredTime: '',
    concerns: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const preferredTimes = [
    { value: 'morning', label: 'Morning (9am - 12pm)' },
    { value: 'afternoon', label: 'Afternoon (12pm - 5pm)' },
    { value: 'evening', label: 'Evening (5pm - 8pm)' },
    { value: 'anytime', label: 'Anytime' }
  ];

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case 'customerName':
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return undefined;

      case 'customerPhone': {
        if (!value.trim()) return 'Phone number is required';
        const phoneResult = validatePhoneNumber(value);
        if (!phoneResult.isValid) return phoneResult.error;
        return undefined;
      }

      case 'customerEmail': {
        if (value.trim()) {
          const emailResult = validateEmail(value);
          if (!emailResult.isValid) return emailResult.error;
        }
        return undefined;
      }

      default:
        return undefined;
    }
  };

  const handleChange = (field: keyof CallbackData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleBlur = (field: string, value: string) => {
    const error = validateField(field, value);
    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const nameError = validateField('customerName', formData.customerName);
    if (nameError) newErrors.customerName = nameError;

    const phoneError = validateField('customerPhone', formData.customerPhone);
    if (phoneError) newErrors.customerPhone = phoneError;

    const emailError = validateField('customerEmail', formData.customerEmail);
    if (emailError) newErrors.customerEmail = emailError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch {
      setErrors({ form: 'Failed to submit. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="callback-form">
      <div className="callback-form-header">
        <h3>Request a Callback</h3>
        <button className="close-btn" onClick={onCancel}>&times;</button>
      </div>

      <form onSubmit={handleSubmit} className="form-step">
        <div className="callback-intro">
          <p>Leave your details and one of our wellness specialists will reach out to discuss your needs and find the perfect solution for you.</p>
        </div>

        {errors.form && <div className="form-error">{errors.form}</div>}

        <div className={`form-group ${errors.customerName ? 'has-error' : ''}`}>
          <label>Your Name *</label>
          <input
            type="text"
            value={formData.customerName}
            onChange={(e) => handleChange('customerName', e.target.value)}
            onBlur={(e) => handleBlur('customerName', e.target.value)}
            placeholder="Enter your name"
          />
          {errors.customerName && <div className="field-error">{errors.customerName}</div>}
        </div>

        <div className={`form-group ${errors.customerPhone ? 'has-error' : ''}`}>
          <label>Phone Number * <span className="label-hint">(with country code)</span></label>
          <input
            type="tel"
            value={formData.customerPhone}
            onChange={(e) => handleChange('customerPhone', e.target.value)}
            onBlur={(e) => handleBlur('customerPhone', e.target.value)}
            placeholder="+92 300 1234567 or +1 555 1234567"
          />
          <div className="field-hint">Include country code: +92 (Pakistan), +1 (USA), +44 (UK), etc.</div>
          {errors.customerPhone && <div className="field-error">{errors.customerPhone}</div>}
        </div>

        <div className={`form-group ${errors.customerEmail ? 'has-error' : ''}`}>
          <label>Email <span className="label-hint">(optional)</span></label>
          <input
            type="email"
            value={formData.customerEmail}
            onChange={(e) => handleChange('customerEmail', e.target.value)}
            onBlur={(e) => handleBlur('customerEmail', e.target.value)}
            placeholder="your@email.com"
          />
          {errors.customerEmail && <div className="field-error">{errors.customerEmail}</div>}
        </div>

        <div className="form-group">
          <label>Best Time to Call</label>
          <select
            className="staff-select"
            value={formData.preferredTime}
            onChange={(e) => handleChange('preferredTime', e.target.value)}
          >
            <option value="">Select preferred time...</option>
            {preferredTimes.map(time => (
              <option key={time.value} value={time.value}>{time.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>What can we help you with? <span className="label-hint">(optional)</span></label>
          <textarea
            className="concerns-textarea"
            value={formData.concerns}
            onChange={(e) => handleChange('concerns', e.target.value)}
            placeholder="Tell us about your concerns, goals, or any questions you have..."
            rows={3}
          />
        </div>

        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Request Callback'}
        </button>
      </form>
    </div>
  );
};

export default CallbackForm;
