import { GroqService, ChatMessage } from './groq';
import { SchedulerService } from './scheduler';
import servicesConfig from '../config/services.json';
import { adminService } from './admin';
import { runQuery } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import Groq from 'groq-sdk';

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
    type: 'book_appointment' | 'show_services' | 'show_hours' | 'escalate' | 'request_callback' | 'booking_confirmed' | 'callback_confirmed' | 'none';
    data?: Record<string, unknown>;
    bookingConfirmation?: BookingConfirmation;
    callbackConfirmation?: CallbackConfirmation;
  };
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
}

interface CommonProblem {
  problem: string;
  causes: string[];
  recommendedServices: string[];
  advice: string;
}

interface IndustryKnowledge {
  commonProblems: CommonProblem[];
  benefits: Record<string, string[]>;
  frequencyRecommendations: Record<string, string>;
}

export class ReceptionistService {
  private groq: GroqService;
  private scheduler: SchedulerService;
  private config: typeof servicesConfig;

  constructor() {
    this.groq = new GroqService();
    this.scheduler = new SchedulerService();
    this.config = servicesConfig;
  }

  getConfig() {
    return this.config;
  }

  // Define tools for function calling - AI decides all intents
  private getTools(): Groq.Chat.ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'show_booking_form',
          description: `Show the booking form. ONLY call when customer CLEARLY wants to book:
- Explicitly says "book", "schedule", "make an appointment"
- Gives clear agreement like "yes", "sure", "let's do it", "ok book it"

DO NOT call this when customer:
- Asks "why?" or "why that one?" (they want explanation, not booking)
- Asks questions about a service (they want info, not booking)
- Says "tell me more" or "what's that?" (they want details)
- Is still exploring/comparing options

When unsure, explain more instead of showing booking form.`,
          parameters: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Brief message (1 sentence, e.g., "Great! Here\'s our booking form.")'
              }
            },
            required: ['message']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'escalate_to_human',
          description: 'Connect customer to a human staff member. Call when customer wants to speak to a real person, manager, or human representative.',
          parameters: {
            type: 'object',
            properties: {
              reason: {
                type: 'string',
                description: 'Brief reason for escalation'
              }
            },
            required: ['reason']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'request_callback',
          description: 'Request a callback. Call ONLY when customer explicitly asks to be called back AND has provided their real name and phone number.',
          parameters: {
            type: 'object',
            properties: {
              customerName: {
                type: 'string',
                description: 'Full name of the customer'
              },
              customerPhone: {
                type: 'string',
                description: 'Phone number with country code'
              },
              customerEmail: {
                type: 'string',
                description: 'Email address (optional)'
              },
              preferredTime: {
                type: 'string',
                description: 'Best time to call: morning, afternoon, evening, or anytime',
                enum: ['morning', 'afternoon', 'evening', 'anytime']
              },
              concerns: {
                type: 'string',
                description: 'Brief note about customer concerns or interests'
              }
            },
            required: ['customerName', 'customerPhone']
          }
        }
      }
    ];
  }

  // Execute booking function
  private async executeBooking(args: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    serviceId: string;
    date: string;
    time: string;
    staffId?: string;
  }): Promise<{ success: boolean; confirmation?: BookingConfirmation; error?: string }> {
    try {
      const appointment = await this.scheduler.bookAppointment({
        customerName: args.customerName,
        customerEmail: args.customerEmail,
        customerPhone: args.customerPhone,
        serviceId: args.serviceId,
        date: args.date,
        time: args.time,
        staffId: args.staffId
      });

      return {
        success: true,
        confirmation: {
          id: appointment.id,
          serviceName: appointment.serviceName,
          staffName: appointment.staffName,
          date: appointment.appointmentDate,
          time: appointment.appointmentTime,
          customerName: appointment.customerName,
          customerEmail: appointment.customerEmail
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Booking failed'
      };
    }
  }

  // Execute callback request function
  private executeCallbackRequest(args: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    preferredTime?: string;
    concerns?: string;
  }): { success: boolean; confirmation?: CallbackConfirmation; error?: string } {
    // Validate that we have real data, not placeholders
    const invalidValues = ['not provided', 'n/a', 'unknown', 'none', ''];
    const nameLower = (args.customerName || '').toLowerCase().trim();
    const phoneLower = (args.customerPhone || '').toLowerCase().trim();

    if (invalidValues.includes(nameLower) || nameLower.length < 2) {
      return { success: false, error: 'Valid customer name is required' };
    }
    if (invalidValues.includes(phoneLower) || phoneLower.length < 5) {
      return { success: false, error: 'Valid phone number is required' };
    }

    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      runQuery(
        `INSERT INTO callbacks (id, customer_name, customer_phone, customer_email, preferred_time, concerns, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          id,
          args.customerName.trim(),
          args.customerPhone.trim(),
          args.customerEmail?.trim() || null,
          args.preferredTime || null,
          args.concerns?.trim() || null,
          now
        ]
      );

      return {
        success: true,
        confirmation: {
          id,
          customerName: args.customerName,
          customerPhone: args.customerPhone,
          preferredTime: args.preferredTime
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Callback request failed'
      };
    }
  }

  // Find relevant FAQs based on user message
  private findRelevantFAQs(message: string): FAQ[] {
    const lowerMessage = message.toLowerCase();
    const faqs = (this.config as { faqs?: FAQ[] }).faqs || [];

    return faqs.filter(faq =>
      faq.keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))
    );
  }

  private buildSystemPrompt(relevantFAQs: FAQ[] = [], staffList: { id: string; name: string; role: string; services: string[] }[] = []): string {
    const { business, hours, services, receptionist } = this.config;
    const faqs = (this.config as { faqs?: FAQ[] }).faqs || [];
    const industryKnowledge = (this.config as { industryKnowledge?: IndustryKnowledge }).industryKnowledge;

    const servicesText = services
      .map(s => `- ${s.name}: ${s.description} (${s.duration} min, $${s.price})`)
      .join('\n');

    // Build staff text
    let staffText = '';
    if (staffList.length > 0) {
      staffText = `\n\n## Our Team\n${staffList.map(s => {
        const serviceNames = s.services.length > 0 ? ` - Specializes in: ${s.services.join(', ')}` : '';
        return `- ${s.name} (${s.role})${serviceNames}`;
      }).join('\n')}`;
    }

    const hoursText = Object.entries(hours)
      .map(([day, h]) => {
        if (!h.open || !h.close) return `- ${day}: Closed`;
        return `- ${day}: ${h.open} - ${h.close}`;
      })
      .join('\n');

    const faqsText = faqs
      .map(f => `Q: ${f.question}\nA: ${f.answer}`)
      .join('\n\n');

    // Build industry knowledge section
    let industryText = '';
    if (industryKnowledge) {
      const problemsText = industryKnowledge.commonProblems
        .map(p => `- "${p.problem}": Common causes include ${p.causes.join(', ')}. ${p.advice}`)
        .join('\n');

      const benefitsText = Object.entries(industryKnowledge.benefits)
        .map(([type, benefits]) => `${type}: ${benefits.join(', ')}`)
        .join('\n');

      industryText = `

## Industry Knowledge - Use This to Help Customers

### Common Customer Problems & Solutions
${problemsText}

### Benefits of Our Services
${benefitsText}

### Recommended Frequency
${Object.entries(industryKnowledge.frequencyRecommendations).map(([type, freq]) => `- ${type}: ${freq}`).join('\n')}`;
    }

    // Build relevant FAQ context if any matched
    let relevantFAQContext = '';
    if (relevantFAQs.length > 0) {
      relevantFAQContext = `\n\n## Relevant Information for This Query
The following FAQ entries are relevant to the user's question. Use this information in your response:
${relevantFAQs.map(f => `- ${f.question}: ${f.answer}`).join('\n')}`;
    }

    return `You are ${receptionist.name}, a ${receptionist.persona} virtual receptionist for ${business.name}.

## CRITICAL: RESPONSE RULES (READ FIRST!)

### 1. LENGTH - MAXIMUM 2-3 SENTENCES
Your responses MUST be short. Count your sentences - if more than 3, you're wrong.

### 2. FORMATTING - USE BULLET POINTS
- Break lists into bullets (•)
- One idea per line
- NO walls of text ever

### 3. CONTEXTUAL AWARENESS
- Remember what the customer said earlier in the conversation
- Reference their specific situation/problem
- Don't repeat questions they already answered
- Build on previous messages naturally

### GOOD vs BAD EXAMPLES

✅ GOOD (Short & Formatted):
"Deep Tissue Massage would be perfect for your back pain!

• Targets deep muscle tension
• Great for desk workers

Ready to book?"

❌ BAD (Too Long - NEVER DO THIS):
"Based on what you've described with your back pain from sitting at a desk all day, I would highly recommend our Deep Tissue Massage service. This treatment is specifically designed to target the deeper layers of muscle tissue where tension tends to build up. Many of our clients who work desk jobs have found significant relief after just one session..."

✅ GOOD (Contextual):
User earlier: "I have back pain from desk work"
User now: "What do you recommend?"
Response: "For your desk-related back pain, try Deep Tissue Massage!"

❌ BAD (Not Contextual):
User earlier: "I have back pain from desk work"
User now: "What do you recommend?"
Response: "What kind of issues are you experiencing?" ← WRONG, they already told you!

## BOOKING - USE show_booking_form FUNCTION

When customer wants to book or agrees to book:
1. Call the show_booking_form function with a brief message
2. NEVER ask for their details - the form handles everything

Call show_booking_form when:
- Customer says "I want to book" or "schedule"
- Customer says "yes", "sure", "sounds good" after you recommend something
- Customer asks about availability or times
- Customer is ready to proceed

Example:
Customer: "I'd like to book a massage"
→ Call show_booking_form with message: "Perfect! Here's our booking form."

Customer: "Yes, I'd like that"
→ Call show_booking_form with message: "Great choice!"

## Business Info
${business.name} - ${business.description}
📞 ${business.phone} | ✉️ ${business.email}
📍 ${business.address}

## Hours
${hoursText}

## Services
${servicesText}${staffText}
${industryText}

## FAQs
${faqsText}

## AVAILABLE ACTIONS (Use these functions when appropriate)

1. **show_booking_form** - Customer wants to book or agrees to book
2. **escalate_to_human** - Customer wants to speak to a real person
3. **request_callback** - Customer explicitly asks to be called back AND gives name+phone

## Callback vs Booking
- "I want to book" → show_booking_form
- "Call me back" → Ask for name+phone first, then request_callback
- "Can I speak to someone?" → escalate_to_human

## Your Job
1. Understand what they need
2. Recommend appropriate service
3. Use the right function based on their intent

Stay short, contextual, use bullets.${relevantFAQContext}`;
  }

  async chat(
    userMessage: string,
    history: ConversationMessage[]
  ): Promise<ReceptionistResponse> {
    // Find relevant FAQs for this message
    const relevantFAQs = this.findRelevantFAQs(userMessage);

    // Get staff from database
    const dbStaff = adminService.getAllStaff(true); // only active staff
    const staffList = dbStaff.map(s => ({
      id: s.id,
      name: s.name,
      role: s.role,
      services: s.services || []
    }));

    const systemPrompt = this.buildSystemPrompt(relevantFAQs, staffList);

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
    const tools = this.getTools();

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

      // Handle escalate_to_human - AI detected escalation intent
      if (functionName === 'escalate_to_human') {
        return {
          message: "I'll connect you with one of our team members who can better assist you. Please call us at " + this.config.business.phone + " or we'll have someone reach out to you shortly.",
          action: { type: 'escalate', data: { reason: functionArgs.reason } }
        };
      }

      // Handle callback request
      if (functionName === 'request_callback') {
        const result = this.executeCallbackRequest(functionArgs);

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
    }

    // No function call - AI chose to respond with just a message
    const aiResponse = response.content || '';
    return {
      message: aiResponse || "I'm here to help! How can I assist you today?",
      action: { type: 'none' }
    };
  }

  getServices() {
    return this.config.services;
  }

  getBusinessHours() {
    return this.config.hours;
  }

  getBusinessInfo() {
    return this.config.business;
  }
}
