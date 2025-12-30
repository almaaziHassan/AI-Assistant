import React, { useState, useEffect, useCallback } from 'react';
import { validatePhoneNumber, validateEmail } from '../utils/validation';
import PhoneInput from './PhoneInput';

interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
}

interface Staff {
  id: string;
  name: string;
  role: string;
  services?: string[];
}

interface TimeSlot {
  time: string;
  available: boolean;
}

interface AppointmentFormProps {
  serverUrl: string;
  onSubmit: (booking: BookingData) => void;
  onCancel: () => void;
}

interface BookingData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId: string;
  staffId?: string;
  date: string;
  time: string;
}

interface ValidationErrors {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

const AppointmentForm: React.FC<AppointmentFormProps> = ({ serverUrl, onSubmit, onCancel }) => {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [closedDayMessage, setClosedDayMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<BookingData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    serviceId: '',
    staffId: '',
    date: '',
    time: ''
  });

  // Get min date (today) and max date (30 days from now)
  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Format date for display
  const formatDateForDisplay = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format time for display (24h to 12h)
  const formatTimeForDisplay = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  // Validation functions
  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'customerName':
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return undefined;
      case 'customerEmail': {
        if (!value.trim()) return 'Email is required';
        const emailResult = validateEmail(value);
        if (!emailResult.isValid) return emailResult.error;
        return undefined;
      }
      case 'customerPhone': {
        if (!value.trim()) return 'Phone number is required';
        const phoneResult = validatePhoneNumber(value);
        if (!phoneResult.isValid) return phoneResult.error;
        return undefined;
      }
      default:
        return undefined;
    }
  };

  // Fetch services and staff on mount
  useEffect(() => {
    setLoading(true);
    const timestamp = Date.now();
    Promise.all([
      fetch(`${serverUrl}/api/services?_t=${timestamp}`, {
        headers: { 'Cache-Control': 'no-cache' }
      }).then(res => {
        if (!res.ok) throw new Error('Failed to load services');
        return res.json();
      }),
      fetch(`${serverUrl}/api/services/staff?_t=${timestamp}`, {
        headers: { 'Cache-Control': 'no-cache' }
      }).then(res => {
        if (!res.ok) return []; // Staff is optional
        return res.json();
      })
    ])
      .then(([servicesData, staffData]) => {
        setServices(servicesData);
        // Filter to only active staff
        setStaff(staffData.filter((s: Staff & { isActive?: boolean }) => s.isActive !== false));
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load services. Please try again.');
        setLoading(false);
      });
  }, [serverUrl]);

  // Fetch available slots when date, service, or staff change
  useEffect(() => {
    if (formData.date && formData.serviceId) {
      setLoading(true);
      setSlots([]);
      setClosedDayMessage(null);
      setError(null);

      // Build URL with optional staffId for staff-specific availability
      // Add timestamp to prevent caching
      let url = `${serverUrl}/api/appointments/slots?date=${formData.date}&serviceId=${formData.serviceId}&_t=${Date.now()}`;
      if (formData.staffId) {
        url += `&staffId=${formData.staffId}`;
      }

      fetch(url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to load times');
          return res.json();
        })
        .then(data => {
          // Ensure we have valid slot data
          const slotsData = Array.isArray(data.slots) ? data.slots : [];

          // Filter to only available slots (available: true)
          const availableCount = slotsData.filter((s: { available: boolean }) => s.available).length;

          // Set slots immediately
          setSlots(slotsData);

          // Check if we have AVAILABLE slots (not just any slots)
          if (availableCount > 0) {
            setClosedDayMessage(null);
          } else {
            // No available slots - either closed or fully booked
            const dayName = new Date(formData.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
            setClosedDayMessage(`No available times on ${dayName}. This day may be closed or fully booked.`);
          }

          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load slots:', err);
          setError('Failed to load available times. Please try again.');
          setSlots([]);
          setLoading(false);
        });
    }
  }, [formData.date, formData.serviceId, formData.staffId, serverUrl]);

  const handleServiceSelect = (serviceId: string) => {
    setError(null);
    setFormData({ ...formData, serviceId, staffId: '', time: '', date: '' });
    setStep(2);
  };

  const handleStaffSelect = (staffId: string) => {
    setFormData({ ...formData, staffId });
  };

  const handleDateSelect = (date: string) => {
    setError(null);
    setClosedDayMessage(null);
    setFormData({ ...formData, date, time: '' });
  };

  const handleTimeSelect = (time: string) => {
    setError(null);
    setFormData({ ...formData, time });
    setStep(3);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Clear validation error for this field
    if (validationErrors[name as keyof ValidationErrors]) {
      setValidationErrors({ ...validationErrors, [name]: undefined });
    }
  };

  const handlePhoneChange = useCallback((phone: string) => {
    setFormData(prev => ({ ...prev, customerPhone: phone }));
    // Clear phone validation error
    if (validationErrors.customerPhone) {
      setValidationErrors(prev => ({ ...prev, customerPhone: undefined }));
    }
  }, [validationErrors.customerPhone]);

  const handlePhoneBlur = useCallback(() => {
    const error = validateField('customerPhone', formData.customerPhone);
    if (error) {
      setValidationErrors(prev => ({ ...prev, customerPhone: error }));
    }
  }, [formData.customerPhone]);

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    if (error) {
      setValidationErrors({ ...validationErrors, [name]: error });
    }
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    const nameError = validateField('customerName', formData.customerName);
    if (nameError) errors.customerName = nameError;

    const emailError = validateField('customerEmail', formData.customerEmail);
    if (emailError) errors.customerEmail = emailError;

    const phoneError = validateField('customerPhone', formData.customerPhone);
    if (phoneError) errors.customerPhone = phoneError;

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = (targetStep: number) => {
    setError(null);
    setValidationErrors({});
    setStep(targetStep);
  };

  const selectedService = services.find(s => s.id === formData.serviceId);
  const selectedStaff = staff.find(s => s.id === formData.staffId);
  const availableSlots = slots.filter(s => s.available);

  return (
    <div className="appointment-form">
      <div className="appointment-form-header">
        <h3>Book Appointment</h3>
        <button className="close-btn" onClick={onCancel} aria-label="Close">&times;</button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* Step 1: Select Service */}
      {step === 1 && (
        <div className="form-step">
          <h4>Select a Service</h4>
          {loading ? (
            <div className="loading">Loading services...</div>
          ) : services.length === 0 ? (
            <div className="no-slots">No services available</div>
          ) : (
            <div className="service-list">
              {services.map(service => (
                <button
                  key={service.id}
                  className="service-option"
                  onClick={() => handleServiceSelect(service.id)}
                >
                  <div className="service-name">{service.name}</div>
                  <div className="service-details">
                    {service.duration} min • ${service.price}
                  </div>
                  <div className="service-description">{service.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select Date & Time */}
      {step === 2 && (
        <div className="form-step">
          <button className="back-btn" onClick={() => handleBack(1)}>&larr; Back</button>
          <h4>Select Date & Time</h4>

          <div className="selected-service">
            {selectedService?.name} - {selectedService?.duration} min (${selectedService?.price})
          </div>

          {/* Staff Selection */}
          {staff.length > 0 && (
            <div className="staff-picker">
              <label>Preferred Staff Member (Optional):</label>
              <select
                value={formData.staffId}
                onChange={(e) => handleStaffSelect(e.target.value)}
                className="staff-select"
              >
                <option value="">No preference</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="date-picker">
            <label>Select Date:</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleDateSelect(e.target.value)}
              min={today}
              max={maxDate}
            />
          </div>

          {formData.date && (
            <div className="time-slots">
              <label>Available Times for {formatDateForDisplay(formData.date)}:</label>
              {loading ? (
                <div className="loading">Loading available times...</div>
              ) : closedDayMessage ? (
                <div className="no-slots">{closedDayMessage}</div>
              ) : availableSlots.length === 0 ? (
                <div className="no-slots">No available times for this date. Please select another date.</div>
              ) : (
                <div className="slots-grid">
                  {availableSlots.map(slot => (
                    <button
                      key={slot.time}
                      className={`time-slot ${formData.time === slot.time ? 'selected' : ''}`}
                      onClick={() => handleTimeSelect(slot.time)}
                    >
                      {formatTimeForDisplay(slot.time)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Contact Details */}
      {step === 3 && (
        <div className="form-step">
          <button className="back-btn" onClick={() => handleBack(2)}>&larr; Back</button>
          <h4>Your Details</h4>

          <div className="booking-summary">
            <strong>{selectedService?.name}</strong><br />
            {selectedStaff && <>with {selectedStaff.name}<br /></>}
            {formatDateForDisplay(formData.date)}<br />
            at {formatTimeForDisplay(formData.time)}
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className={`form-group ${validationErrors.customerName ? 'has-error' : ''}`}>
              <label>Name *</label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                placeholder="Your full name"
                disabled={submitting}
                autoComplete="name"
              />
              {validationErrors.customerName && (
                <div className="field-error">{validationErrors.customerName}</div>
              )}
            </div>
            <div className={`form-group ${validationErrors.customerEmail ? 'has-error' : ''}`}>
              <label>Email *</label>
              <input
                type="email"
                name="customerEmail"
                value={formData.customerEmail}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                placeholder="your@email.com"
                disabled={submitting}
                autoComplete="email"
              />
              {validationErrors.customerEmail && (
                <div className="field-error">{validationErrors.customerEmail}</div>
              )}
            </div>
            <div className={`form-group ${validationErrors.customerPhone ? 'has-error' : ''}`}>
              <label>Phone *</label>
              <PhoneInput
                value={formData.customerPhone}
                onChange={handlePhoneChange}
                onBlur={() => handlePhoneBlur()}
                disabled={submitting}
                error={validationErrors.customerPhone}
              />
            </div>
            <button
              type="submit"
              className="submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Booking...' : 'Confirm Booking'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AppointmentForm;
