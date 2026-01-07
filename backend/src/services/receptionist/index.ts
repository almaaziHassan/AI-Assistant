/**
 * Main Receptionist Service
 * Orchestrates AI-powered chat interactions for the virtual receptionist
 * 
 * This refactored version is much cleaner - large functions have been
 * extracted into separate modules for better maintainability
 */

import { GroqService, ChatMessage } from '../groq';
import servicesConfig from '../../config/services.json';
import { adminService, AdminService } from '../admin';
import { getTools } from './tools';
import { buildSystemPrompt } from './promptBuilder';
import {
    executeBooking,
    executeCallbackRequest,
    lookupAppointments,
    cancelAppointment as cancelAppointmentHandler,
    getAppointmentForReschedule
} from './handlers';
import {
    ReceptionistResponse,
    ConversationMessage,
    FAQ,
    BookingConfirmation,
    CallbackConfirmation
} from './types';

// Re-export types for backward compatibility
export type {
    BookingConfirmation,
    CallbackConfirmation,
    ReceptionistResponse
};

// Cache for services and staff to avoid DB calls on every chat message
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class ReceptionistService {
    private groq: GroqService;
    private config: typeof servicesConfig;
    private adminService: AdminService;

    // In-memory cache for frequently accessed data
    private servicesCache: CacheEntry<ReturnType<AdminService['getAllServices']>> | null = null;
    private staffCache: CacheEntry<ReturnType<AdminService['getAllStaff']>> | null = null;

    constructor(
        groq: GroqService = new GroqService(),
        config = servicesConfig,
        adminSvc: AdminService = adminService
    ) {
        this.groq = groq;
        this.config = config;
        this.adminService = adminSvc;
    }

    /**
     * Get cached services or fetch from DB if cache expired
     */
    private getCachedServices() {
        const now = Date.now();
        if (this.servicesCache && (now - this.servicesCache.timestamp) < CACHE_TTL_MS) {
            return this.servicesCache.data;
        }
        const services = this.adminService.getAllServices(true);
        this.servicesCache = { data: services, timestamp: now };
        return services;
    }

    /**
     * Get cached staff or fetch from DB if cache expired
     */
    private getCachedStaff() {
        const now = Date.now();
        if (this.staffCache && (now - this.staffCache.timestamp) < CACHE_TTL_MS) {
            return this.staffCache.data;
        }
        const staff = this.adminService.getAllStaff(true);
        this.staffCache = { data: staff, timestamp: now };
        return staff;
    }

    /**
     * Invalidate cache (call when services/staff are updated)
     */
    invalidateCache() {
        this.servicesCache = null;
        this.staffCache = null;
    }

    getConfig() {
        return this.config;
    }

    /**
     * Find relevant FAQs based on user message keywords
     */
    private findRelevantFAQs(message: string): FAQ[] {
        const lowerMessage = message.toLowerCase();
        const faqs = (this.config as { faqs?: FAQ[] }).faqs || [];

        return faqs.filter(faq =>
            faq.keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))
        );
    }

    /**
     * Main chat method - handles conversation with AI
     */
    async chat(
        userMessage: string,
        history: ConversationMessage[]
    ): Promise<ReceptionistResponse> {
        // Find relevant FAQs for this message
        const relevantFAQs = this.findRelevantFAQs(userMessage);

        // Get services from cache (avoids DB call on every message)
        const dbServices = this.getCachedServices();
        const servicesList = dbServices.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            duration: s.duration,
            price: s.price
        }));

        // Get staff from cache (avoids DB call on every message)
        const dbStaff = this.getCachedStaff();
        const staffList = dbStaff.map(s => {
            // Map service IDs to names for AI context
            const serviceNames = (s.services || []).map(sid => {
                const service = dbServices.find(dS => dS.id === sid);
                return service ? service.name : null;
            }).filter((n): n is string => n !== null);

            return {
                id: s.id,
                name: s.name,
                role: s.role,
                services: serviceNames // Send Names instead of IDs
            };
        });

        const systemPrompt = buildSystemPrompt(relevantFAQs, staffList, servicesList);

        // Build messages array for Groq
        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...history.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
            }))
        ];

        // Don't add user message again if it's already in history
        if (history.length === 0 || history[history.length - 1].content !== userMessage) {
            messages.push({ role: 'user', content: userMessage });
        }

        // Get tools for function calling
        const tools = getTools();

        // Get AI response with function calling
        const response = await this.groq.chatWithFunctions(messages, tools);

        // Check if AI wants to call a function
        if (response.toolCalls && response.toolCalls.length > 0) {
            const toolCall = response.toolCalls[0];
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);

            // Handle show_booking_form - AI detected booking intent
            if (functionName === 'show_booking_form') {
                return {
                    message: functionArgs.message || "Here's our booking form.",
                    action: { type: 'book_appointment' }
                };
            }

            // Handle provide_contact_info - AI detected user wants direct contact
            if (functionName === 'provide_contact_info') {
                const { business } = this.config;
                const contactMessage = `Here's how you can reach us directly:

• **Phone:** ${business.phone}
• **Email:** ${business.email}
• **Address:** ${business.address}

Would you like us to call you back instead? I can set that up for you!`;

                return {
                    message: contactMessage,
                    action: { type: 'offer_callback', data: { reason: functionArgs.reason } }
                };
            }

            // Handle offer_callback_form - User agreed to get a callback
            if (functionName === 'offer_callback_form') {
                return {
                    message: functionArgs.message || "I'll get that set up for you!",
                    action: { type: 'request_callback' }
                };
            }

            // Handle callback request
            if (functionName === 'request_callback') {
                const result = executeCallbackRequest(functionArgs);

                if (result.success && result.confirmation) {
                    const confirmationMessage = `I've submitted your callback request. Our wellness team will reach out to you at ${result.confirmation.customerPhone} ` +
                        (result.confirmation.preferredTime ? `during the ${result.confirmation.preferredTime}` : 'as soon as possible') +
                        `. We look forward to speaking with you, ${result.confirmation.customerName}!`;

                    return {
                        message: confirmationMessage,
                        action: {
                            type: 'callback_confirmed',
                            callbackConfirmation: result.confirmation
                        }
                    };
                } else {
                    return {
                        message: `I apologize, but I couldn't submit the callback request: ${result.error}. Please try again or call us directly.`,
                        action: { type: 'none' }
                    };
                }
            }

            // ========== APPOINTMENT MANAGEMENT HANDLERS ==========

            // Handle lookup_appointments - Find customer's appointments by email
            if (functionName === 'lookup_appointments') {
                const result = lookupAppointments(functionArgs.customerEmail);

                if (!result.success) {
                    return {
                        message: `I couldn't look up your appointments: ${result.error}. Please try again.`,
                        action: { type: 'none' }
                    };
                }

                if (!result.appointments || result.appointments.length === 0) {
                    return {
                        message: `I don't see any upcoming appointments for ${functionArgs.customerEmail}. Would you like to book a new appointment?`,
                        action: { type: 'no_appointments_found', data: { email: functionArgs.customerEmail } }
                    };
                }

                // Format appointments for display
                const aptList = result.appointments.map((apt, i) => {
                    // Debug: log raw values
                    console.log(`[format] Apt ${i + 1}: date=${apt.date}, time=${apt.time}`);

                    // Handle different date formats
                    let formattedDate = apt.date;
                    let formattedTime = apt.time;

                    try {
                        // Try to parse and format the date
                        if (apt.date) {
                            const dateObj = new Date(apt.date + 'T12:00:00'); // Use noon to avoid timezone issues
                            if (!isNaN(dateObj.getTime())) {
                                formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                            }
                        }

                        // Try to format the time
                        if (apt.time) {
                            const [hours, minutes] = apt.time.split(':').map(Number);
                            if (!isNaN(hours) && !isNaN(minutes)) {
                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                const displayHours = hours % 12 || 12;
                                formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                            }
                        }
                    } catch (e) {
                        console.error(`[format] Error formatting apt ${i + 1}:`, e);
                    }

                    return `${i + 1}. **${apt.serviceName}** on ${formattedDate} at ${formattedTime}${apt.staffName ? ` with ${apt.staffName}` : ''}`;
                }).join('\n');

                return {
                    message: `I found ${result.appointments.length} upcoming appointment(s):\n\n${aptList}\n\nWould you like to cancel or reschedule any of these?`,
                    action: {
                        type: 'appointments_found',
                        data: {
                            appointments: result.appointments,
                            email: functionArgs.customerEmail
                        }
                    }
                };
            }

            // Handle cancel_appointment - Cancel a specific appointment
            if (functionName === 'cancel_appointment') {
                const result = cancelAppointmentHandler(functionArgs.appointmentId, functionArgs.reason);

                if (!result.success) {
                    return {
                        message: `I couldn't cancel that appointment: ${result.error}`,
                        action: { type: 'none' }
                    };
                }

                if (result.cancelledAppointment) {
                    const apt = result.cancelledAppointment;

                    // Format date safely
                    let formattedDate = apt.date;
                    let formattedTime = apt.time;

                    try {
                        if (apt.date) {
                            const dateObj = new Date(apt.date + 'T12:00:00');
                            if (!isNaN(dateObj.getTime())) {
                                formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                            }
                        }
                        if (apt.time) {
                            const [hours, minutes] = apt.time.split(':').map(Number);
                            if (!isNaN(hours) && !isNaN(minutes)) {
                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                const displayHours = hours % 12 || 12;
                                formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                            }
                        }
                    } catch (e) {
                        console.error('[cancel] Error formatting date:', e);
                    }

                    return {
                        message: `✅ I've cancelled your **${apt.serviceName}** appointment on ${formattedDate} at ${formattedTime}. You'll receive a confirmation email shortly.\n\nWould you like to book a new appointment?`,
                        action: {
                            type: 'appointment_cancelled',
                            data: { appointment: apt }
                        }
                    };
                }

                return {
                    message: 'The appointment has been cancelled.',
                    action: { type: 'appointment_cancelled' }
                };
            }

            // Handle start_reschedule - Begin rescheduling process
            if (functionName === 'start_reschedule') {
                const result = getAppointmentForReschedule(functionArgs.appointmentId);

                if (!result.success || !result.appointment) {
                    return {
                        message: `I couldn't start the rescheduling process: ${result.error}`,
                        action: { type: 'none' }
                    };
                }

                const apt = result.appointment;

                return {
                    message: functionArgs.message || `Let's pick a new date and time for your ${apt.serviceName} appointment.`,
                    action: {
                        type: 'reschedule_appointment',
                        data: {
                            originalAppointmentId: apt.id,
                            serviceId: apt.serviceId,
                            staffId: apt.staffId,
                            serviceName: apt.serviceName,
                            staffName: apt.staffName,
                            customerName: apt.customerName,
                            customerEmail: apt.customerEmail
                        }
                    }
                };
            }
        }

        // No function call - AI chose to respond with just a message
        const aiResponse = response.content || '';

        // FALLBACK: Check if AI outputted function call as text
        // Handles: <function(name){...}> OR <function(name){...}</function>
        const functionCallMatch = aiResponse.match(/<function\((\w+)\)(\{.*?\})?(?:>|<\/function>)/);
        if (functionCallMatch) {
            const functionName = functionCallMatch[1];
            let functionArgs: Record<string, string> = {};

            if (functionCallMatch[2]) {
                try {
                    functionArgs = JSON.parse(functionCallMatch[2]);
                } catch (e) {
                    // Ignore parse errors
                }
            }

            // Handle the function call
            if (functionName === 'show_booking_form') {
                return {
                    message: functionArgs.message || "Here's our booking form.",
                    action: { type: 'book_appointment' }
                };
            }

            if (functionName === 'offer_callback_form' || functionName === 'provide_contact_info') {
                return {
                    message: functionArgs.message || "I'll help you get in touch with us!",
                    action: { type: 'request_callback' }
                };
            }
        }

        return {
            message: aiResponse || "I'm here to help! How can I assist you today?",
            action: { type: 'none' }
        };
    }

    getServices() {
        return this.adminService.getAllServices(true);
    }

    getBusinessHours() {
        return this.config.hours;
    }

    getBusinessInfo() {
        return this.config.business;
    }
}
