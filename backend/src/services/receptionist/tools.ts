import Groq from 'groq-sdk';

/**
 * Define AI function calling tools
 * These tools allow the AI to trigger specific actions based on user intent
 * 
 * Why function calling: More reliable than parsing free-text responses
 * The AI can trigger specific actions with validated parameters
 */
export function getTools(): Groq.Chat.ChatCompletionTool[] {
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
                name: 'provide_contact_info',
                description: `ALWAYS call this when customer mentions ANY of these:
- "contact" / "contact directly" / "direct contact"
- "speak to someone" / "speak to a person" / "real person" / "human"
- "phone number" / "call you" / "your number"
- "email" / "email address"
- "talk to staff" / "talk to manager"

Examples that MUST trigger this:
- "can I contact directly?" → YES
- "I want to speak to someone" → YES
- "what's your phone number?" → YES
- "how can I reach you?" → YES

DO NOT call this for simple agreement words like "good", "ok", "thanks", "great" unless they specifically ask for contact info.`,
                parameters: {
                    type: 'object',
                    properties: {
                        reason: {
                            type: 'string',
                            description: 'Brief reason (e.g., "wants phone number", "wants to speak to person")'
                        }
                    },
                    required: ['reason']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'offer_callback_form',
                description: `Show the callback request form. ALWAYS call when:
- Customer says "yes", "sure", "ok", "good", "great", "sounds good" after you offered a callback
- Customer says "call me back" / "call me" / "callback"
- Customer agrees to be contacted

Examples that MUST trigger this:
- "yes please call me back" → YES
- "good" (after you offered callback) → YES
- "sounds good" (after you offered callback) → YES
- "call me instead" → YES`,
                parameters: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            description: 'Brief message (e.g., "Perfect, I\'ll set that up!")'
                        }
                    },
                    required: ['message']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'request_callback',
                description: 'Submit a callback request. Call ONLY when customer has already provided their real name and phone number in the conversation.',
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
        },
        // ========== APPOINTMENT MANAGEMENT TOOLS ==========
        {
            type: 'function',
            function: {
                name: 'lookup_appointments',
                description: `Look up customer's existing appointments by email.

USE WHEN: Customer wants to view, cancel, change, or reschedule their appointment(s).

FLOW:
1. If customer hasn't provided email yet → Ask for it naturally
2. When email is provided (like "john@example.com") → Call this function
3. Response will include appointment details WITH IDs
4. Use those IDs for cancel_appointment or start_reschedule

IMPORTANT: Only call when you have an actual email address from the customer.`,
                parameters: {
                    type: 'object',
                    properties: {
                        customerEmail: {
                            type: 'string',
                            description: 'Customer email address they used when booking'
                        }
                    },
                    required: ['customerEmail']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'cancel_appointment',
                description: `Cancel a specific appointment by ID.

⚠️ CRITICAL: The appointmentId MUST come from a previous lookup_appointments result!
- You cannot guess or make up appointment IDs
- You MUST have called lookup_appointments first and received the ID in the response

Required flow:
1. Customer asks to cancel → You ask for email
2. Customer gives email → You call lookup_appointments
3. lookup_appointments returns list with IDs → You show list to customer
4. Customer picks one → You confirm with them
5. Customer confirms → You call cancel_appointment with the exact ID from step 3

⚠️ NEVER call this if you haven't called lookup_appointments first!`,
                parameters: {
                    type: 'object',
                    properties: {
                        appointmentId: {
                            type: 'string',
                            description: 'Exact appointment ID from lookup_appointments response (UUID format like "abc123-def456")'
                        },
                        reason: {
                            type: 'string',
                            description: 'Optional reason for cancellation'
                        }
                    },
                    required: ['appointmentId']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'start_reschedule',
                description: `Start rescheduling an appointment.

⚠️ CRITICAL: The appointmentId MUST come from a previous lookup_appointments result!
- You cannot guess or make up appointment IDs

Required flow:
1. Customer asks to reschedule → You ask for email
2. Customer gives email → You call lookup_appointments  
3. lookup_appointments returns list with IDs → You show list to customer
4. Customer picks one → You confirm they want to reschedule
5. Customer confirms → You call start_reschedule with the exact ID from step 3

This will open the booking form pre-filled with customer info.`,
                parameters: {
                    type: 'object',
                    properties: {
                        appointmentId: {
                            type: 'string',
                            description: 'Exact appointment ID from lookup_appointments response (UUID format)'
                        },
                        message: {
                            type: 'string',
                            description: 'Message to show (e.g., "Let\'s pick a new date and time!")'
                        }
                    },
                    required: ['appointmentId', 'message']
                }
            }
        }
    ];
}

