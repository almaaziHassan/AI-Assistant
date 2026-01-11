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
import { KnowledgeService } from '../knowledge';
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
    CallbackConfirmation,
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
    private defaultConfig: typeof servicesConfig;
    private adminService: AdminService;
    private knowledgeService: KnowledgeService;

    // In-memory cache for frequently accessed data
    private servicesCache: CacheEntry<ReturnType<AdminService['getAllServices']>> | null = null;
    private staffCache: CacheEntry<ReturnType<AdminService['getAllStaff']>> | null = null;
    private faqsCache: CacheEntry<FAQ[]> | null = null;
    private configCache: CacheEntry<any> | null = null;

    // Session context for tracking last looked-up appointments per email
    // This allows the AI to reference appointments by number (e.g., "cancel the first one")
    private appointmentContext: Map<string, {
        appointments: Array<{ id: string; serviceName: string; date: string; time: string }>;
        timestamp: number;
    }> = new Map();

    // Track selected appointment when user picks one but hasn't said action yet
    private selectedAppointment: { id: string; serviceName: string } | null = null;

    constructor(
        groq: GroqService = new GroqService(),
        config = servicesConfig,
        adminSvc: AdminService = adminService
    ) {
        this.groq = groq;
        this.defaultConfig = config;
        this.adminService = adminSvc;
        this.knowledgeService = KnowledgeService.getInstance();

        // Initialize knowledge base (fire and forget)
        this.knowledgeService.initialize().catch(err => {
            console.error('Failed to initialize Knowledge Service in Receptionist:', err);
        });
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
     * Get cached FAQs or fetch from DB if cache expired
     */
    private getCachedFAQs(): FAQ[] {
        const now = Date.now();
        if (this.faqsCache && (now - this.faqsCache.timestamp) < CACHE_TTL_MS) {
            return this.faqsCache.data;
        }

        // Fetch from DB
        const dbFaqs = this.adminService.getAllFAQs(true);
        this.faqsCache = { data: dbFaqs, timestamp: now };
        return dbFaqs;
    }

    /**
     * Get full configuration (business, hours, etc.) from DB or fallback
     */
    private getFullConfig() {
        const now = Date.now();
        if (this.configCache && (now - this.configCache.timestamp) < CACHE_TTL_MS) {
            return this.configCache.data;
        }

        // Fetch settings from DB
        try {
            const industryKnowledgeSetting = this.adminService.getSystemSetting('industryKnowledge');
            const businessSetting = this.adminService.getSystemSetting('business');
            const receptionistSetting = this.adminService.getSystemSetting('receptionist');
            const hoursSetting = this.adminService.getSystemSetting('hours');

            // Merge with default config (DB takes precedence if exists)
            const config = {
                industryKnowledge: industryKnowledgeSetting?.value || this.defaultConfig.industryKnowledge,
                business: businessSetting?.value || this.defaultConfig.business,
                receptionist: receptionistSetting?.value || this.defaultConfig.receptionist,
                hours: hoursSetting?.value || this.defaultConfig.hours,
                faqs: this.getCachedFAQs() // Include FAQs in config return for consistency
            };

            this.configCache = { data: config, timestamp: now };
            return config;
        } catch (error) {
            console.error('Error fetching config from DB, using defaults:', error);
            return {
                ...this.defaultConfig,
                faqs: this.getCachedFAQs().length > 0 ? this.getCachedFAQs() : this.defaultConfig.faqs
            };
        }
    }

    /**
     * Invalidate cache (call when services/staff are updated)
     */
    invalidateCache() {
        this.servicesCache = null;
        this.staffCache = null;
        this.faqsCache = null;
        this.configCache = null;
    }

    /**
     * Public method to get current config
     */
    getConfig() {
        return this.getFullConfig();
    }

    /**
     * Get business info (legacy/route support)
     */
    getBusinessInfo() {
        return this.getFullConfig().business;
    }

    /**
     * Get business hours (legacy/route support)
     */
    getBusinessHours() {
        return this.getFullConfig().hours;
    }

    /**
     * Find relevant FAQs based on user message keywords
     */
    private findRelevantFAQs(message: string): FAQ[] {
        const lowerMessage = message.toLowerCase();
        const config = this.getFullConfig();
        const faqs = (config as { faqs?: FAQ[] }).faqs || [];

        return faqs.filter(faq =>
            faq.keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))
        );
    }

    /**
     * Find appointment from context based on user input
     * Matches by number (1, first, 2, second) or service name
     */
    private findAppointmentFromContext(userMessage: string): { id: string; serviceName: string } | null {
        const msg = userMessage.toLowerCase();

        // Look through all contexts (ideally we'd track by session, but for now check all recent)
        for (const [email, context] of this.appointmentContext.entries()) {
            // Only use context from last 10 minutes
            if (Date.now() - context.timestamp > 10 * 60 * 1000) continue;

            const appointments = context.appointments;
            if (!appointments.length) continue;

            // Try to match by number (1, first, one, 2, second, two, etc.)
            const numberPatterns = [
                { patterns: ['1', 'first', 'one', '#1', 'number 1'], index: 0 },
                { patterns: ['2', 'second', 'two', '#2', 'number 2'], index: 1 },
                { patterns: ['3', 'third', 'three', '#3', 'number 3'], index: 2 },
                { patterns: ['4', 'fourth', 'four', '#4', 'number 4'], index: 3 },
                { patterns: ['5', 'fifth', 'five', '#5', 'number 5'], index: 4 },
                { patterns: ['last', 'final'], index: appointments.length - 1 }
            ];

            for (const { patterns, index } of numberPatterns) {
                if (patterns.some(p => msg.includes(p)) && index < appointments.length) {
                    console.log(`[context] Matched appointment #${index + 1} by number reference`);
                    return appointments[index];
                }
            }

            // Try to match by service name
            for (const apt of appointments) {
                if (msg.includes(apt.serviceName.toLowerCase())) {
                    console.log(`[context] Matched appointment by service name: ${apt.serviceName}`);
                    return apt;
                }
            }
        }

        return null;
    }

    /**
     * Handle direct intent detection - BYPASSES AI completely for appointment flows
     * Returns null if no direct intent detected (let AI handle it)
     */
    private async handleDirectIntent(
        userMessage: string,
        history: ConversationMessage[]
    ): Promise<ReceptionistResponse | null> {
        const msg = userMessage.toLowerCase().trim();

        // Check if message is just an email
        const emailMatch = msg.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);

        // Check if previous message asked for email (cancel/reschedule context)
        const lastAssistantMsg = [...history].reverse().find(m => m.role === 'assistant')?.content?.toLowerCase() || '';
        const wasAskingForEmail = lastAssistantMsg.includes('email') &&
            (lastAssistantMsg.includes('cancel') || lastAssistantMsg.includes('reschedule') ||
                lastAssistantMsg.includes('look up') || lastAssistantMsg.includes('appointment'));

        // If user gave email after being asked
        if (emailMatch && wasAskingForEmail) {
            const email = emailMatch[0].toLowerCase();
            console.log(`[DirectIntent] Email provided after cancel/reschedule context: ${email}`);
            return await this.doAppointmentLookup(email);
        }

        // Check for cancel/reschedule intent with appointment selection
        // Use fuzzy matching to handle common typos
        const cancelPatterns = ['cancel', 'cancle', 'cancell', 'cansel'];
        const reschedulePatterns = ['reschedule', 'reshcdule', 'reschedulle', 'rescheduel',
            'change', 'move', 'different', 'modify', 'update'];

        // Question keywords that indicate the user is asking ABOUT cancellation, not doing it
        const questionKeywords = ['policy', 'fee', 'cost', 'charge', 'how', 'what', 'rule', '?'];

        const isQuestion = questionKeywords.some(q => msg.includes(q));

        // Only treat as intent if it's NOT a general question
        const wantsToCancel = cancelPatterns.some(p => msg.includes(p)) && !isQuestion;
        const wantsToReschedule = reschedulePatterns.some(p => msg.includes(p)) && !isQuestion;

        // Check if last message asked "cancel or reschedule?" about a selected appointment
        const wasAskingAction = lastAssistantMsg.includes('you selected') &&
            lastAssistantMsg.includes('cancel') && lastAssistantMsg.includes('reschedule');

        // If user said just "cancel" or "reschedule" after we asked about their selection
        if (wasAskingAction && (wantsToCancel || wantsToReschedule) && this.selectedAppointment) {
            console.log(`[DirectIntent] Action on previously selected: ${wantsToCancel ? 'cancel' : 'reschedule'} ${this.selectedAppointment.serviceName}`);
            const apt = this.selectedAppointment;
            this.selectedAppointment = null; // Clear after use

            if (wantsToCancel) {
                return await this.doCancelAppointment(apt.id);
            } else {
                return await this.doStartReschedule(apt.id);
            }
        }

        // Check if we have appointments in context and user is selecting one
        const matchedApt = this.findAppointmentFromContext(msg);
        if (matchedApt && (wantsToCancel || wantsToReschedule)) {
            console.log(`[DirectIntent] Matched appointment action: ${wantsToCancel ? 'cancel' : 'reschedule'} ${matchedApt.serviceName}`);
            this.selectedAppointment = null; // Clear any previous selection

            if (wantsToCancel) {
                return await this.doCancelAppointment(matchedApt.id);
            } else {
                return await this.doStartReschedule(matchedApt.id);
            }
        }

        // If just a number/selection without action word, and we showed appointments recently
        if (matchedApt && !wantsToCancel && !wantsToReschedule) {
            // Check if last message was showing appointments
            const wasShowingAppointments = lastAssistantMsg.includes('appointment') &&
                (lastAssistantMsg.includes('cancel') || lastAssistantMsg.includes('reschedule') ||
                    lastAssistantMsg.includes('what would you like'));

            if (wasShowingAppointments) {
                console.log(`[DirectIntent] User selected appointment without action word: ${matchedApt.serviceName}`);
                // SAVE the selection for the next message
                this.selectedAppointment = { id: matchedApt.id, serviceName: matchedApt.serviceName };
                // Ask what they want to do with it
                return {
                    message: `You selected **${matchedApt.serviceName}**. Would you like to **cancel** or **reschedule** this appointment? 📅`,
                    action: { type: 'none' }
                };
            }
        }

        // Pure cancel/reschedule intent without email - ask for email
        if ((wantsToCancel || wantsToReschedule) && !matchedApt) {
            // Check if message contains an email
            const inlineEmail = msg.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (inlineEmail) {
                console.log(`[DirectIntent] Cancel/reschedule with inline email: ${inlineEmail[0]}`);
                return await this.doAppointmentLookup(inlineEmail[0].toLowerCase());
            }

            // If we have a cached email, do a FRESH lookup instead of using stale data
            // This ensures cancelled appointments don't show
            if (this.appointmentContext.size > 0) {
                for (const [email, ctx] of this.appointmentContext.entries()) {
                    if (Date.now() - ctx.timestamp < 10 * 60 * 1000) {
                        console.log(`[DirectIntent] Doing fresh lookup for ${email} (instead of using cache)`);
                        return await this.doAppointmentLookup(email);
                    }
                }
            }

            console.log(`[DirectIntent] Cancel/reschedule intent, asking for email`);
            return {
                message: `To ${wantsToReschedule ? 'reschedule' : 'cancel'} your appointment, I'll need to look it up. 📋\n\nWhat **email address** did you use when booking?`,
                action: { type: 'none' }
            };
        }

        return null; // Let AI handle it
    }

    /**
     * Do appointment lookup and format response
     */
    private async doAppointmentLookup(email: string): Promise<ReceptionistResponse> {
        const result = await lookupAppointments(email);

        if (!result.success) {
            return {
                message: `I couldn't look up appointments: ${result.error}`,
                action: { type: 'none' }
            };
        }

        // DEFENSIVE: Filter out past appointments here too (in case handlers.ts didn't)
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0]; // UTC date YYYY-MM-DD

        const futureAppointments = (result.appointments || []).filter(apt => {
            // Normalize date to YYYY-MM-DD format
            let aptDateStr = apt.date;
            if (typeof apt.date === 'string' && apt.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                aptDateStr = apt.date;
            } else {
                try {
                    aptDateStr = new Date(String(apt.date)).toISOString().split('T')[0];
                } catch {
                    aptDateStr = todayStr; // If parsing fails, include it
                }
            }

            // ONLY filter out appointments from BEFORE today
            // Don't filter by time - timezone issues between UTC server and local appointments
            if (aptDateStr < todayStr) {
                console.log(`[doAppointmentLookup] Filtering past date: ${aptDateStr} < ${todayStr}`);
                return false;
            }
            return true;
        });

        console.log(`[doAppointmentLookup] ${result.appointments?.length || 0} total, ${futureAppointments.length} future`);

        if (futureAppointments.length === 0) {
            return {
                message: `📋 No upcoming appointments found for **${email}**\n\nWould you like to **book a new appointment**? 📅`,
                action: { type: 'no_appointments_found', data: { email } }
            };
        }

        // Store in context (only future appointments)
        this.appointmentContext.set(email, {
            appointments: futureAppointments.map(apt => ({
                id: apt.id,
                serviceName: apt.serviceName,
                date: apt.date,
                time: apt.time
            })),
            timestamp: Date.now()
        });

        return this.formatAppointmentList(futureAppointments, email, 'both');
    }

    /**
     * Format appointment list for display
     */
    private formatAppointmentList(
        appointments: Array<{ id: string; serviceName: string; date: string; time: string; staffName?: string }>,
        email: string,
        action: 'cancel' | 'reschedule' | 'both'
    ): ReceptionistResponse {
        const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        const aptList = appointments.map((apt, i) => {
            let formattedDate = String(apt.date);
            let formattedTime = String(apt.time);
            try {
                // Handle both Date objects and "YYYY-MM-DD" strings
                let dateStr: string = String(apt.date);

                // Check if it's already in YYYY-MM-DD format
                if (typeof apt.date === 'string' && apt.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    dateStr = apt.date;
                } else {
                    // Try to parse as Date and convert to YYYY-MM-DD
                    const parsed = new Date(String(apt.date));
                    if (!isNaN(parsed.getTime())) {
                        dateStr = parsed.toISOString().split('T')[0];
                    }
                }

                if (typeof dateStr === 'string' && dateStr.includes('-')) {
                    const [year, month, day] = dateStr.split('-').map(Number);
                    const dateObj = new Date(year, month - 1, day);
                    if (!isNaN(dateObj.getTime())) {
                        formattedDate = `${WEEKDAYS[dateObj.getDay()]}, ${MONTHS[dateObj.getMonth()]} ${day}`;
                    }
                }

                // Handle time - ensure it's a string in HH:MM:SS format
                let timeStr = apt.time;
                if (typeof timeStr === 'string' && timeStr.includes(':')) {
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    if (!isNaN(hours) && !isNaN(minutes)) {
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        formattedTime = `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                    }
                }
            } catch (e) {
                console.error('[formatAppointmentList] Date formatting error:', e);
            }
            return `**${i + 1}.** 📅 ${apt.serviceName} — ${formattedDate} at ${formattedTime}${apt.staffName ? ` with ${apt.staffName}` : ''}`;
        }).join('\n');

        const actionPrompt = action === 'both'
            ? 'Would you like to **cancel** or **reschedule** any of these?'
            : `Which one would you like to **${action}**?`;

        return {
            message: `Here are your upcoming appointments:\n\n${aptList}\n\n${actionPrompt} ✨`,
            action: {
                type: 'appointments_found',
                data: { appointments, email }
            }
        };
    }

    /**
     * Do cancel appointment
     */
    private async doCancelAppointment(appointmentId: string): Promise<ReceptionistResponse> {
        const result = await cancelAppointmentHandler(appointmentId);

        if (!result.success) {
            return {
                message: `I couldn't cancel that appointment. ${result.error}`,
                action: { type: 'none' }
            };
        }

        if (result.cancelledAppointment) {
            const apt = result.cancelledAppointment;
            return {
                message: `✅ **Appointment Cancelled**\n\n📅 ${apt.serviceName} has been cancelled.\n\n📧 A confirmation email is on its way!\n\nWould you like to **book a new appointment**? 💆`,
                action: {
                    type: 'appointment_cancelled',
                    data: { appointment: apt }
                }
            };
        }

        return {
            message: '✅ The appointment has been cancelled.',
            action: { type: 'appointment_cancelled' }
        };
    }

    /**
     * Do start reschedule
     */
    private async doStartReschedule(appointmentId: string): Promise<ReceptionistResponse> {
        const result = await getAppointmentForReschedule(appointmentId);

        if (!result.success || !result.appointment) {
            return {
                message: `I couldn't start the rescheduling. ${result.error}`,
                action: { type: 'none' }
            };
        }

        const apt = result.appointment;
        return {
            message: `Let's reschedule your **${apt.serviceName}** appointment! 📅\n\nI'll open our booking form so you can pick a new date and time.`,
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

        // Get config to pass to prompt builder
        const config = this.getFullConfig();

        let systemPrompt = buildSystemPrompt(relevantFAQs, staffList, servicesList, config);

        // ============================================================
        // CONTEXT-AWARE RAG: QUERY REWRITING
        // ============================================================
        let searchParam = userMessage;

        // Only need to rewrite if there is conversation history to reference
        if (history.length > 0) {
            try {
                // Quick LLM call to contextualize the query
                const rewritePrompt = `
You are a helpful assistant. Rewrite the user's latest message into a standalone search query based on the conversation history.
If the message is already standalone, return it as is.
If the message refers to previous context (e.g. "how much is it?", "what about that?"), make it specific.
Do NOT answer the question. Only return the rewritten query.

History:
${history.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

User: ${userMessage}
Rewritten Query:`;

                const rewritten = await this.groq.getChatCompletion([
                    { role: 'system', content: 'You are a precise query rewriter.' },
                    { role: 'user', content: rewritePrompt }
                ], { temperature: 0.1, maxTokens: 50 });

                if (rewritten && rewritten.trim()) {
                    searchParam = rewritten.trim();
                    console.log(`[RAG] Rewrote query: "${userMessage}" -> "${searchParam}"`);
                }
            } catch (error) {
                console.warn('[RAG] Query rewriting failed, using original:', error);
            }
        }

        // Search Knowledge Base (Hybrid RAG) using the Contextualized Query
        const relevantDocs = await this.knowledgeService.search(searchParam, 2);

        if (relevantDocs.length > 0) {
            const knowledgeContext = relevantDocs.map(doc =>
                `[KNOWLEDGE: ${doc.title}]\n${doc.content}`
            ).join('\n\n');
            systemPrompt += `\n\nRELEVANT KNOWLEDGE BASE INFORMATION (Derived from query: "${searchParam}"):\nUse this information to answer detailed questions if applicable:\n${knowledgeContext}`;
        }

        // ============================================================
        // DIRECT INTENT DETECTION - BYPASS AI FOR APPOINTMENT MANAGEMENT
        // ============================================================

        const directResult = await this.handleDirectIntent(userMessage, history);
        if (directResult) {
            console.log('[DirectIntent] Handled directly:', directResult.action?.type);
            return directResult;
        }

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

        // ============================================================
        // FALLBACK: PARSE TEXT-BASED FUNCTION CALLS (HALLUCINATIONS)
        // ============================================================
        // Sometimes LLMs output tags like <function=name>args</function> instead of native calls
        if (!response.toolCalls && response.content) {
            // Regex: <function=name>args</function> OR <function=name{args}</function>
            const funcRegex = /<function=([a-zA-Z0-9_]+)(?:>|\s|(?=\{))(.*?)<\/function>/s;
            const match = response.content.match(funcRegex);

            if (match) {
                const name = match[1].trim();
                let rawArgs = match[2].trim();
                if (rawArgs.startsWith('>')) rawArgs = rawArgs.substring(1).trim();

                let args = {};
                try {
                    // Try to parse args - look for the first { and last }
                    const jsonStart = rawArgs.indexOf('{');
                    const jsonEnd = rawArgs.lastIndexOf('}');
                    if (jsonStart !== -1 && jsonEnd !== -1) {
                        const jsonStr = rawArgs.substring(jsonStart, jsonEnd + 1);
                        args = JSON.parse(jsonStr);
                    } else if (rawArgs.includes('message')) {
                        // Loose parsing if JSON is malformed
                        const msgMatch = rawArgs.match(/"message"\s*:\s*"(.*?)"/);
                        if (msgMatch) args = { message: msgMatch[1] };
                    }
                } catch (e) {
                    console.warn('[Receptionist] Failed to parse function args JSON:', rawArgs);
                }

                console.log(`[Receptionist] Detected text-based function call: ${name}`);

                // Polyfill the toolCalls
                response.toolCalls = [{
                    id: 'hallucinated-call',
                    type: 'function',
                    function: {
                        name: name,
                        arguments: JSON.stringify(args)
                    }
                }];
                // Clear content so we don't show the raw tag to user
                response.content = null;
            }
        }

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
                const { business } = this.getFullConfig(); // Use dynamic business info
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
                const result = await executeCallbackRequest(functionArgs);

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
                const result = await lookupAppointments(functionArgs.customerEmail);

                if (!result.success) {
                    return {
                        message: `I couldn't look up your appointments: ${result.error}. Please try again.`,
                        action: { type: 'none' }
                    };
                }

                if (!result.appointments || result.appointments.length === 0) {
                    return {
                        message: `📋 No upcoming appointments found for **${functionArgs.customerEmail}**\n\nWould you like to **book a new appointment**? 📅`,
                        action: { type: 'no_appointments_found', data: { email: functionArgs.customerEmail } }
                    };
                }

                // Format appointments for display
                const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

                const aptList = result.appointments.map((apt, i) => {
                    // Handle different date formats
                    let formattedDate = apt.date;
                    let formattedTime = apt.time;

                    try {
                        // Format date manually (toLocaleDateString unreliable on servers)
                        if (apt.date) {
                            const [year, month, day] = apt.date.split('-').map(Number);
                            const dateObj = new Date(year, month - 1, day); // month is 0-indexed
                            if (!isNaN(dateObj.getTime())) {
                                const weekday = WEEKDAYS[dateObj.getDay()];
                                const monthName = MONTHS[dateObj.getMonth()];
                                formattedDate = `${weekday}, ${monthName} ${day}`;
                            }
                        }

                        // Format time manually (12-hour with AM/PM)
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

                    // Keep display clean for users, IDs are in action.data.appointments
                    return `**${i + 1}.** 📅 ${apt.serviceName} — ${formattedDate} at ${formattedTime}${apt.staffName ? ` with ${apt.staffName}` : ''}`;
                }).join('\n');

                // Store appointments in session context for later reference
                const email = functionArgs.customerEmail.toLowerCase();
                this.appointmentContext.set(email, {
                    appointments: result.appointments.map(apt => ({
                        id: apt.id,
                        serviceName: apt.serviceName,
                        date: apt.date,
                        time: apt.time
                    })),
                    timestamp: Date.now()
                });
                console.log(`[lookup] Stored ${result.appointments.length} appointments in context for ${email}`);

                return {
                    message: `Here are your upcoming appointments:\n\n${aptList}\n\nWhat would you like to do? 💆`,
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
                let appointmentId = functionArgs.appointmentId;

                // If no valid UUID, try to find appointment from context
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (!appointmentId || !uuidRegex.test(appointmentId)) {
                    console.log(`[cancel] Invalid ID "${appointmentId}", checking context...`);

                    // Try to match from stored appointment context
                    const matchedApt = this.findAppointmentFromContext(userMessage);
                    if (matchedApt) {
                        appointmentId = matchedApt.id;
                        console.log(`[cancel] Found appointment from context: ${matchedApt.serviceName}`);
                    }
                }

                const result = await cancelAppointmentHandler(appointmentId, functionArgs.reason);

                if (!result.success) {
                    // Check if the user message contains an email - if so, do automatic lookup
                    const emailMatch = userMessage.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    if (emailMatch) {
                        const email = emailMatch[0].toLowerCase();
                        console.log(`[cancel_appointment] Auto-lookup with email from message: ${email}`);
                        const lookupResult = await lookupAppointments(email);

                        if (lookupResult.success && lookupResult.appointments && lookupResult.appointments.length > 0) {
                            // Found appointments - show them
                            const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

                            const aptList = lookupResult.appointments.map(apt => {
                                let formattedDate = apt.date;
                                let formattedTime = apt.time;
                                try {
                                    const [year, month, day] = apt.date.split('-').map(Number);
                                    const dateObj = new Date(year, month - 1, day);
                                    if (!isNaN(dateObj.getTime())) {
                                        formattedDate = `${WEEKDAYS[dateObj.getDay()]}, ${MONTHS[dateObj.getMonth()]} ${day}`;
                                    }
                                    const [hours, minutes] = apt.time.split(':').map(Number);
                                    if (!isNaN(hours) && !isNaN(minutes)) {
                                        const ampm = hours >= 12 ? 'PM' : 'AM';
                                        formattedTime = `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                                    }
                                } catch { }
                                return `📅 **${apt.serviceName}** — ${formattedDate} at ${formattedTime}${apt.staffName ? ` with ${apt.staffName}` : ''}`;
                            }).join('\n');

                            return {
                                message: `Here are your upcoming appointments:\n\n${aptList}\n\nWhich one would you like to **cancel**? ✨`,
                                action: {
                                    type: 'appointments_found',
                                    data: { appointments: lookupResult.appointments, email }
                                }
                            };
                        } else {
                            return {
                                message: `📋 No upcoming appointments found for **${email}**\n\nWould you like to **book a new appointment**? 📅`,
                                action: { type: 'no_appointments_found', data: { email } }
                            };
                        }
                    }

                    // No email in message - ask for it
                    return {
                        message: "To cancel your appointment, I'll need to look it up first. 📋\n\nWhat **email address** did you use when booking?",
                        action: { type: 'none' }
                    };
                }

                if (result.cancelledAppointment) {
                    const apt = result.cancelledAppointment;

                    // Format date safely
                    let formattedDate = apt.date;
                    let formattedTime = apt.time;

                    // Manual date formatting (same as lookup)
                    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

                    try {
                        if (apt.date) {
                            const [year, month, day] = apt.date.split('-').map(Number);
                            const dateObj = new Date(year, month - 1, day);
                            if (!isNaN(dateObj.getTime())) {
                                const weekday = WEEKDAYS[dateObj.getDay()];
                                const monthName = MONTHS[dateObj.getMonth()];
                                formattedDate = `${weekday}, ${monthName} ${day}`;
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
                        message: `✅ **Appointment Cancelled**\n\n📅 ${apt.serviceName} — ${formattedDate} at ${formattedTime}\n\n📧 A confirmation email is on its way!\n\nWould you like to **book a new appointment**? 💆`,
                        action: {
                            type: 'appointment_cancelled',
                            data: { appointment: apt }
                        }
                    };
                }

                return {
                    message: '✅ The appointment has been cancelled.',
                    action: { type: 'appointment_cancelled' }
                };
            }

            // Handle start_reschedule - Initiate reschedule for a specific appointment
            if (functionName === 'start_reschedule') {
                let appointmentId = functionArgs.appointmentId;

                // Handle UUID or context fallback
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (!appointmentId || !uuidRegex.test(appointmentId)) {
                    // Try to match from stored appointment context
                    const matchedApt = this.findAppointmentFromContext(userMessage);
                    if (matchedApt) {
                        appointmentId = matchedApt.id;
                    }
                }

                const result = await getAppointmentForReschedule(appointmentId);

                if (!result.success || !result.appointment) {
                    // If failed, check for email like in cancel
                    const emailMatch = userMessage.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    if (emailMatch) {
                        // ... (Email lookup logic could be duplicated here, but omitting for brevity - cancel is prioritised)
                        return await this.doAppointmentLookup(emailMatch[0].toLowerCase());
                    }

                    return {
                        message: "To reschedule, I first need to find your appointment. 📋\n\nWhat **email address** did you use when booking?",
                        action: { type: 'none' }
                    };
                }

                const apt = result.appointment;
                return {
                    message: `Let's reschedule your **${apt.serviceName}** appointment! 📅\n\nI'll open our booking form so you can pick a new date and time.`,
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

        // Return AI response
        return {
            message: response.content || "I'm having trouble connecting right now. Please try again or call us directly.",
            action: { type: 'none' }
        };
    }
}
