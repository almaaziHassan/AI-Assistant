import Groq from 'groq-sdk';

/**
 * Define AI function calling tools
 * These tools allow the AI to trigger specific actions based on user intent
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
- "how can I reach you?" → YES`,
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
- Customer says "yes", "sure", "ok" after you offered a callback
- Customer says "call me back" / "call me" / "callback"
- Customer agrees to be contacted

Examples that MUST trigger this:
- "yes please call me back" → YES
- "sure, I'd like a callback" → YES
- "yes" (after you offered callback) → YES
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
        }
    ];
}
