import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import MessageList from './MessageList';
import InputBox from './InputBox';
import AppointmentForm, { Service } from './AppointmentForm';
import CallbackForm from './CallbackForm';

interface ChatWidgetProps {
  serverUrl: string;
  defaultOpen?: boolean;
  onClose?: () => void;
}

interface BookingData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId: string;
  date: string;
  time: string;
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

const ChatWidget: React.FC<ChatWidgetProps> = ({ serverUrl, defaultOpen = false, onClose }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showCallbackForm, setShowCallbackForm] = useState(false);
  const [prefetchedServices, setPrefetchedServices] = useState<Service[] | null>(null);

  // Get auth token for user-specific conversation history
  const authToken = localStorage.getItem('auth_token');

  const { messages, isConnected, isTyping, error, sendMessage, addLocalMessage, startNewConversation, saveConfirmationToServer } = useChat({ serverUrl, authToken });

  // Track if we've already triggered prefetch
  const hasPrefetched = useRef(false);

  // Open chat when defaultOpen changes to true
  useEffect(() => {
    if (defaultOpen) {
      setIsOpen(true);
    }
  }, [defaultOpen]);

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
      const response = await fetch(`${serverUrl}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking)
      });

      if (response.ok) {
        const appointment = await response.json();
        setShowBookingForm(false);

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

        // Add confirmation card to local state
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

  const handleShowCallbackForm = () => {
    setShowCallbackForm(true);
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
                onCancel={() => setShowBookingForm(false)}
                prefetchedServices={prefetchedServices || undefined}
              />
            ) : showCallbackForm ? (
              <CallbackForm
                serverUrl={serverUrl}
                onSubmit={handleCallbackSubmit}
                onCancel={() => setShowCallbackForm(false)}
              />
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
