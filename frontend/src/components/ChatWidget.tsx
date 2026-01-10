import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../hooks/useAuth';
import MessageList from './MessageList';
import InputBox from './InputBox';
import AppointmentForm, { Service } from './AppointmentForm';
import CallbackForm from './CallbackForm';
import AppointmentSelector from './AppointmentSelector';

interface ChatWidgetProps {
  serverUrl: string;
  defaultOpen?: boolean;
  onClose?: () => void;
  rescheduleIntent?: { appointmentId: string } | null;
  onRescheduleHandled?: () => void;  // Callback to clear the intent after handling
  onBookingComplete?: () => void;    // Callback to refresh dashboard/appointments
}

interface BookingData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId: string;
  date: string;
  time: string;
  userId?: string;  // Added: Link booking to user account if logged in
}

interface CallbackData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  preferredTime: string;
  concerns: string;
}

// Cache for prefetched data - persists across renders
interface PrefetchCache {
  services: Service[] | null;
  staff: Record<string, unknown[]>; // keyed by serviceId
  timestamp: number;
}

const prefetchCache: PrefetchCache = {
  services: null,
  staff: {},
  timestamp: 0
};

const PREFETCH_TTL = 60 * 1000; // 60 seconds

const ChatWidget: React.FC<ChatWidgetProps> = ({
  serverUrl,
  defaultOpen = false,
  onClose,
  rescheduleIntent,
  onRescheduleHandled,
  onBookingComplete
}) => {
  const { user } = useAuth(); // Get current user for linking bookings
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showCallbackForm, setShowCallbackForm] = useState(false);
  const [prefetchedServices, setPrefetchedServices] = useState<Service[] | null>(null);

  // Rescheduling state - tracks appointment being rescheduled
  const [rescheduleData, setRescheduleData] = useState<{
    originalAppointmentId: string;
    serviceId: string;
    staffId?: string;
    serviceName: string;
    customerName: string;
    customerEmail: string;
  } | null>(null);

  // Appointment selector state - shows clickable appointment cards
  const [appointmentSelectorData, setAppointmentSelectorData] = useState<{
    appointments: Array<{ id: string; serviceName: string; date: string; time: string; staffName?: string }>;
    email: string;
  } | null>(null);

  // Get auth token from auth context (reactive when user logs in/out)
  // user is already available from useAuth() at line 58
  const authToken = user ? localStorage.getItem('auth_token') : null;

  const { messages, isConnected, isTyping, error, sendMessage, addLocalMessage, startNewConversation, saveConfirmationToServer } = useChat({ serverUrl, authToken });

  // Track if we've already triggered prefetch
  const hasPrefetched = useRef(false);

  // Handle reschedule intent from dashboard
  useEffect(() => {
    if (rescheduleIntent?.appointmentId) {
      console.log('[ChatWidget] Handling reschedule intent for:', rescheduleIntent.appointmentId);

      // Fetch appointment details and open reschedule form
      const fetchAndReschedule = async () => {
        try {
          const response = await fetch(`${serverUrl}/api/appointments/${rescheduleIntent.appointmentId}`);
          if (!response.ok) throw new Error('Failed to fetch appointment');

          const appointment = await response.json();
          console.log('[ChatWidget] Appointment details:', appointment);

          // Set reschedule data to trigger the booking form in reschedule mode
          setRescheduleData({
            originalAppointmentId: appointment.id,
            serviceId: appointment.serviceId,
            staffId: appointment.staffId,
            serviceName: appointment.serviceName,
            customerName: appointment.customerName,
            customerEmail: appointment.customerEmail
          });

          // Show the booking form
          setShowBookingForm(true);

          // Add a message to the chat
          addLocalMessage(
            `I'd like to reschedule my ${appointment.serviceName} appointment.`,
            'user'
          );
          addLocalMessage(
            `Of course! Let's reschedule your ${appointment.serviceName} appointment. Please select a new date and time below.`,
            'assistant'
          );

          // Clear the intent
          onRescheduleHandled?.();
        } catch (err) {
          console.error('[ChatWidget] Error fetching appointment for reschedule:', err);
          addLocalMessage('Sorry, I could not find that appointment. Please try again.', 'assistant');
          onRescheduleHandled?.();
        }
      };

      fetchAndReschedule();
    }
  }, [rescheduleIntent?.appointmentId]);

  // Open chat when defaultOpen changes to true
  useEffect(() => {
    if (defaultOpen) {
      setIsOpen(true);
    }
  }, [defaultOpen]);

  // Handle reschedule_appointment action from AI
  // When AI triggers rescheduling, open booking form with pre-filled data
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.action?.type === 'reschedule_appointment' && lastMessage.action.data) {
      const data = lastMessage.action.data as {
        originalAppointmentId: string;
        serviceId: string;
        staffId?: string;
        serviceName: string;
        customerName: string;
        customerEmail: string;
      };
      setRescheduleData(data);
      setShowBookingForm(true);
    }
  }, [messages]);

  // When AI finds appointments, show the appointment selector with clickable cards
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.action?.type === 'appointments_found' && lastMessage.action.data) {
      const data = lastMessage.action.data as {
        appointments: Array<{ id: string; serviceName: string; date: string; time: string; staffName?: string }>;
        email: string;
      };
      if (data.appointments && data.appointments.length > 0) {
        setAppointmentSelectorData(data);
      }
    }
  }, [messages]);

  // Prefetch services when chat widget opens - makes booking form instant!
  useEffect(() => {
    if (isOpen && !hasPrefetched.current) {
      hasPrefetched.current = true;

      // Check if cache is still valid
      const now = Date.now();
      if (prefetchCache.services && (now - prefetchCache.timestamp) < PREFETCH_TTL) {
        setPrefetchedServices(prefetchCache.services);
        return; // Use cached data
      }

      // Prefetch services in background (non-blocking)
      fetch(`${serverUrl}/api/services`)
        .then(res => res.ok ? res.json() : [])
        .then((data: Service[]) => {
          prefetchCache.services = data;
          prefetchCache.timestamp = Date.now();
          setPrefetchedServices(data);
        })
        .catch(() => { }); // Fail silently - form will retry if needed
    }
  }, [isOpen, serverUrl]);

  // Forms are now shown only when user clicks the button
  // No auto-show - user controls when to open the form

  const toggleWidget = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    if (!newIsOpen && onClose) {
      onClose();
    }
  };

  const formatTime12Hour = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const handleBookingSubmit = async (booking: BookingData) => {
    try {
      // If this is a reschedule, cancel the original appointment first
      if (rescheduleData?.originalAppointmentId) {
        await fetch(`${serverUrl}/api/appointments/${rescheduleData.originalAppointmentId}`, {
          method: 'DELETE'
        });
        // Note: We don't block on cancel errors - continue with new booking
      }

      // Add userId to booking if user is logged in
      // This links the appointment to their account for the My Appointments tab
      const bookingWithUser = {
        ...booking,
        userId: user?.id || undefined
      };

      const response = await fetch(`${serverUrl}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingWithUser)
      });

      if (response.ok) {
        const appointment = await response.json();
        setShowBookingForm(false);
        setRescheduleData(null); // Clear reschedule data

        const confirmationData = {
          serviceName: appointment.serviceName,
          staffName: appointment.staffName,
          date: new Date(booking.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          time: formatTime12Hour(booking.time),
          confirmationId: appointment.id.substring(0, 8).toUpperCase(),
          email: booking.customerEmail
        };

        // Add confirmation card to local state (immediate feedback)
        addLocalMessage(
          'Your appointment has been confirmed!',
          'assistant',
          {
            type: 'confirmation',
            confirmation: confirmationData
          }
        );

        // Save to server for persistence on refresh
        saveConfirmationToServer(
          'Your appointment has been confirmed!',
          'confirmation',
          'booking_confirmed',
          {
            bookingConfirmation: {
              id: appointment.id,
              serviceName: appointment.serviceName,
              staffName: appointment.staffName,
              date: booking.date,
              time: booking.time,
              customerName: booking.customerName,
              customerEmail: booking.customerEmail
            }
          }
        );

        // Notify parent to refresh data (page reload)
        // Delay slightly to ensure socket event is sent before reload
        if (onBookingComplete) {
          setTimeout(() => {
            onBookingComplete();
          }, 500);
        }
      } else {
        const err = await response.json();
        throw new Error(err.error || 'Failed to book appointment');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      addLocalMessage(
        `I couldn't complete your booking: ${errorMessage}`,
        'assistant'
      );
      setShowBookingForm(false);
    }
  };

  const handleShowBookingForm = () => {
    setShowBookingForm(true);
  };

  const handleCloseBookingForm = () => {
    setShowBookingForm(false);
    setRescheduleData(null); // Clear reschedule data when closing form
  };

  const handleShowCallbackForm = () => {
    setShowCallbackForm(true);
  };

  // Handle cancel from appointment selector
  const handleAppointmentCancel = async (appointmentId: string, serviceName: string) => {
    setAppointmentSelectorData(null); // Close selector
    addLocalMessage(`Cancel my ${serviceName} appointment`);

    try {
      // Use DELETE method as the API expects
      const response = await fetch(`${serverUrl}/api/appointments/${appointmentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        addLocalMessage(`✅ Your ${serviceName} appointment has been cancelled. Would you like to book a new appointment?`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Cancel failed:', errorData);
        addLocalMessage(`There was an issue cancelling your appointment. Please try again.`);
      }
    } catch (err) {
      console.error('Cancel error:', err);
      addLocalMessage(`There was an issue cancelling your appointment. Please try again.`);
    }
  };

  // Handle reschedule from appointment selector
  const handleAppointmentReschedule = async (appointmentId: string, serviceName: string) => {
    setAppointmentSelectorData(null); // Close selector
    addLocalMessage(`Reschedule my ${serviceName} appointment`);

    // Get appointment details to pre-fill the form
    try {
      const response = await fetch(`${serverUrl}/api/appointments/${appointmentId}`);
      if (response.ok) {
        const apt = await response.json();

        // Set reschedule data - this includes the original appointment ID for cancellation
        setRescheduleData({
          originalAppointmentId: appointmentId,
          serviceId: apt.serviceId,
          staffId: apt.staffId,
          serviceName: apt.serviceName || serviceName,
          customerName: apt.customerName,
          customerEmail: apt.customerEmail
        });

        // Open booking form with pre-filled data
        setShowBookingForm(true);

        addLocalMessage(`Let's reschedule your **${serviceName}** appointment! 📅\n\nI've opened the booking form with your details pre-filled. Just pick a new date and time.`);
      } else {
        // Fallback: open form without pre-fill
        setRescheduleData({
          originalAppointmentId: appointmentId,
          serviceId: '',
          serviceName: serviceName,
          customerName: '',
          customerEmail: ''
        });
        setShowBookingForm(true);
        addLocalMessage(`Let's reschedule your appointment! Please fill in the booking form.`);
      }
    } catch (err) {
      console.error('Error fetching appointment for reschedule:', err);
      // Fallback
      setRescheduleData({
        originalAppointmentId: appointmentId,
        serviceId: '',
        serviceName: serviceName,
        customerName: '',
        customerEmail: ''
      });
      setShowBookingForm(true);
      addLocalMessage(`Let's reschedule your appointment! Please fill in the booking form.`);
    }
  };

  const handleCloseAppointmentSelector = () => {
    setAppointmentSelectorData(null);
  };

  const handleCallbackSubmit = async (callback: CallbackData) => {
    try {
      const response = await fetch(`${serverUrl}/api/callbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callback)
      });

      if (response.ok) {
        const result = await response.json();
        setShowCallbackForm(false);

        const callbackConfData = {
          name: callback.customerName,
          phone: callback.customerPhone,
          preferredTime: callback.preferredTime || 'Anytime',
          requestId: result.id?.substring(0, 8).toUpperCase() || 'PENDING'
        };

        // Add callback confirmation card to local state
        addLocalMessage(
          'Your callback request has been submitted!',
          'assistant',
          {
            type: 'callback_confirmation',
            callbackConfirmation: callbackConfData
          }
        );

        // Save to server for persistence on refresh
        saveConfirmationToServer(
          'Your callback request has been submitted!',
          'callback_confirmation',
          'callback_confirmed',
          {
            callbackConfirmation: {
              id: result.id,
              customerName: callback.customerName,
              customerPhone: callback.customerPhone,
              preferredTime: callback.preferredTime
            }
          }
        );
      } else {
        const err = await response.json();
        throw new Error(err.error || 'Failed to submit callback request');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      addLocalMessage(
        `I couldn't submit your callback request: ${errorMessage}`,
        'assistant'
      );
      setShowCallbackForm(false);
    }
  };

  // Check if we should show a "Book Now" quick action
  // Show if ANY recent message (last 3) suggests booking - keeps button visible after errors
  const recentMessages = messages.slice(-3);
  const shouldShowBookButton =
    recentMessages.some(m => m.role === 'assistant' && m.action?.type === 'book_appointment') &&
    !showBookingForm && !showCallbackForm;

  // Check if we should show a "Request Callback" quick action
  // Show when AI offers callback (offer_callback) or explicitly requests callback form (request_callback)
  const shouldShowCallbackButton =
    recentMessages.some(m => m.role === 'assistant' &&
      (m.action?.type === 'request_callback' || m.action?.type === 'offer_callback')) &&
    !showCallbackForm && !showBookingForm;

  return (
    <div className="ai-receptionist-widget">
      {/* Chat Window */}
      {isOpen && (
        <div className="ai-receptionist-window">
          <div className="ai-receptionist-header">
            <div className="ai-receptionist-header-info">
              <div className="ai-receptionist-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <div className="ai-receptionist-title">Virtual Assistant</div>
                <div className="ai-receptionist-status">
                  <span className={`status-dot ${isConnected ? 'online' : 'offline'}`}></span>
                  {isConnected ? 'Online' : 'Connecting...'}
                </div>
              </div>
            </div>
            <div className="ai-receptionist-header-actions">
              <button
                className="ai-receptionist-new-chat"
                onClick={startNewConversation}
                title="Start new conversation"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <button className="ai-receptionist-close" onClick={toggleWidget}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="ai-receptionist-body">
            {error && (
              <div className="ai-receptionist-error">
                {error}
              </div>
            )}

            {showBookingForm ? (
              <AppointmentForm
                serverUrl={serverUrl}
                onSubmit={handleBookingSubmit}
                onCancel={handleCloseBookingForm}
                prefetchedServices={prefetchedServices || undefined}
                // Pre-fill customer info when rescheduling
                initialCustomerName={rescheduleData?.customerName}
                initialCustomerEmail={rescheduleData?.customerEmail}
                initialServiceId={rescheduleData?.serviceId}
                isRescheduling={!!rescheduleData}
              />
            ) : showCallbackForm ? (
              <CallbackForm
                serverUrl={serverUrl}
                onSubmit={handleCallbackSubmit}
                onCancel={() => setShowCallbackForm(false)}
              />
            ) : appointmentSelectorData ? (
              <>
                <MessageList messages={messages} isTyping={isTyping} />
                <AppointmentSelector
                  appointments={appointmentSelectorData.appointments}
                  onCancel={handleAppointmentCancel}
                  onReschedule={handleAppointmentReschedule}
                  onClose={handleCloseAppointmentSelector}
                />
              </>
            ) : (
              <>
                <MessageList messages={messages} isTyping={isTyping} />

                {/* Quick Action Buttons */}
                {(shouldShowBookButton || shouldShowCallbackButton) && (
                  <div className="quick-actions">
                    {shouldShowBookButton && (
                      <button className="quick-action-btn" onClick={handleShowBookingForm}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        Book Appointment
                      </button>
                    )}
                    {shouldShowCallbackButton && (
                      <button className="quick-action-btn callback-btn" onClick={handleShowCallbackForm}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        Request Callback
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {!showBookingForm && !showCallbackForm && (
            <InputBox onSend={sendMessage} disabled={!isConnected} />
          )}
        </div>
      )}

      {/* Toggle Button */}
      <button
        className={`ai-receptionist-toggle ${isOpen ? 'open' : ''}`}
        onClick={toggleWidget}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default ChatWidget;
