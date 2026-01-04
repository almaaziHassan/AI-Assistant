import servicesConfig from '../../config/services.json';

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

/**
 * Build the system prompt for the AI receptionist
 * This highly detailed prompt guides the AI's behavior and responses
 */
export function buildSystemPrompt(
    relevantFAQs: FAQ[] = [],
    staffList: { id: string; name: string; role: string; services: string[] }[] = [],
    servicesList: { id: string; name: string; description?: string; duration: number; price: number }[] = []
): string {
    const { business, hours, receptionist } = servicesConfig;
    const faqs = (servicesConfig as { faqs?: FAQ[] }).faqs || [];
    const industryKnowledge = (servicesConfig as { industryKnowledge?: IndustryKnowledge }).industryKnowledge;

    const servicesText = servicesList
        .map(s => `- ${s.name}: ${s.description || 'Service'} (${s.duration} min, $${s.price})`)
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

1. **show_booking_form** - Customer clearly wants to book or agrees to book
2. **provide_contact_info** - Customer wants to contact directly, speak to someone, or get contact details
3. **offer_callback_form** - Customer agrees to a callback (after you offered it)
4. **request_callback** - Customer gave their name+phone in conversation (rare - usually use offer_callback_form)

## Intent Flow Examples
- "I want to book" → show_booking_form
- "Can I contact you directly?" → provide_contact_info (gives phone/email + offers callback)
- "Can I speak to someone?" → provide_contact_info
- "Yes, please call me back" (after you offered) → offer_callback_form
- "I'd like a callback" → provide_contact_info first, then offer_callback_form if they confirm

## Your Job
1. Understand what they need
2. Recommend appropriate service
3. Use the right function based on their intent

Stay short, contextual, use bullets.${relevantFAQContext}`;
}
