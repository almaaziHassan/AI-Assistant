/**
 * Type definitions for the receptionist service
 */

export interface BookingConfirmation {
    id: string;
    serviceName: string;
    staffName?: string;
    date: string;
    time: string;
    customerName: string;
    customerEmail: string;
}

export interface CallbackConfirmation {
    id: string;
    customerName: string;
    customerPhone: string;
    preferredTime?: string;
}

export interface ReceptionistResponse {
    message: string;
    action?: {
        type:
        // Booking actions
        | 'book_appointment'
        | 'show_services'
        | 'show_hours'
        | 'booking_confirmed'
        // Contact actions
        | 'escalate'
        | 'request_callback'
        | 'offer_callback'
        | 'callback_confirmed'
        // Appointment management actions (new)
        | 'appointments_found'
        | 'no_appointments_found'
        | 'appointment_cancelled'
        | 'reschedule_appointment'
        // Fallback
        | 'none';
        data?: Record<string, unknown>;
        bookingConfirmation?: BookingConfirmation;
        callbackConfirmation?: CallbackConfirmation;
    };
}

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface FAQ {
    id: string;
    question: string;
    answer: string;
    keywords: string[];
}
