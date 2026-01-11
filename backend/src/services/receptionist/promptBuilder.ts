import { FAQ } from '../admin/types';

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

interface BusinessConfig {
    name: string;
    description: string;
    phone: string;
    email: string;
    address: string;
    website?: string;
}

interface ReceptionistConfig {
    name: string;
    persona: string;
    greeting: string;
    fallbackMessage: string;
    escalationMessage: string;
}

interface HoursConfig {
    [day: string]: { open?: string; close?: string };
}

/**
 * Build the system prompt for the AI receptionist
 * This highly detailed prompt guides the AI's behavior and responses
 */
export function buildSystemPrompt(
    relevantFAQs: FAQ[] = [],
    staffList: { id: string; name: string; role: string; services: string[] }[] = [],
    servicesList: { id: string; name: string; description?: string; duration: number; price: number }[] = [],
    config: {
        business: BusinessConfig;
        hours: HoursConfig;
        receptionist: ReceptionistConfig;
        industryKnowledge?: IndustryKnowledge;
    }
): string {
    const { business, hours, receptionist, industryKnowledge } = config;

    // Build Services Text
    const servicesText = servicesList
        .map(s => `- ${s.name}: ${s.description || 'Service'} (${s.duration} min, $${s.price})`)
        .join('\n');

    // Build Staff Text
    let staffText = '';
    if (staffList.length > 0) {
        staffText = `\n\n## Our Team\n${staffList.map(s => {
            const serviceNames = s.services.length > 0 ? ` - Specializes in: ${s.services.join(', ')}` : '';
            return `- ${s.name} (${s.role})${serviceNames}`;
        }).join('\n')}`;
    }

    // Build Hours Text
    const hoursText = Object.entries(hours)
        .map(([day, h]) => {
            if (!h.open || !h.close) return `- ${day}: Closed`;
            return `- ${day}: ${h.open} - ${h.close}`;
        })
        .join('\n');

    // Build Industry Knowledge Section
    let industryText = '';
    if (industryKnowledge) {
        const problemsText = (industryKnowledge.commonProblems || [])
            .map(p => `- "${p.problem}": Common causes include ${p.causes.join(', ')}. ${p.advice}`)
            .join('\n');

        const benefitsText = Object.entries(industryKnowledge.benefits || {})
            .map(([type, benefits]) => `${type}: ${benefits.join(', ')}`)
            .join('\n');

        const freqText = Object.entries(industryKnowledge.frequencyRecommendations || {})
            .map(([type, freq]) => `- ${type}: ${freq}`)
            .join('\n');

        industryText = `
\n## Industry Knowledge - Use This to Help Customers

### Common Customer Problems & Solutions
${problemsText}

### Benefits of Our Services
${benefitsText}

### Recommended Frequency
${freqText}`;
    }

    // Build relevant FAQ context if any matched
    let relevantFAQContext = '';
    if (relevantFAQs.length > 0) {
        relevantFAQContext = `\n\n## Relevant Information for This Query
The following FAQ entries are relevant to the user's question. Use this information in your response:
${relevantFAQs.map(f => `- ${f.question}: ${f.answer}`).join('\n')}`;
    }

    return `You are ${receptionist.name}, a ${receptionist.persona} virtual receptionist for ${business.name}.

## CRITICAL: RESPONSE FORMATTING (READ FIRST!)

### 1. LENGTH - BE CONCISE
- Maximum 2-3 sentences for simple answers
- Use short paragraphs, never walls of text

### 2. VISUAL FORMATTING - Make Responses Scannable
Use these elements to make responses visually appealing:
- **Bold** for important terms (service names, times, prices)
- Emojis for visual cues: 💆 services, 📅 dates, ⏰ times, ✅ confirmations, 📍 location
- Bullet points (•) for lists
- Line breaks between sections

### 3. STRUCTURE FOR LISTS
When showing multiple items, format as:
1. **Item Name** — Brief description
2. **Item Name** — Brief description

For appointments:
📅 **Service Name** — Date at Time with Staff

### AESTHETIC EXAMPLES

✅ GOOD (Visually Appealing):
"Here are your appointments:

📅 **Deep Tissue Massage** — Tuesday, Jan 6 at 9:00 AM with Sarah

Would you like to cancel or reschedule?"

✅ GOOD (Service Recommendation):
"For your back pain, I'd recommend:

💆 **Deep Tissue Massage** — Targets deep muscle tension, perfect for desk workers ($80, 60 min)

Ready to book? 📅"

❌ BAD (Plain Text):
"You have a Deep Tissue Massage on Tuesday January 6 at 9:00 AM with Sarah. Let me know if you want to cancel or reschedule it."

### 4. CONTEXTUAL AWARENESS
- Remember what the customer said earlier
- Reference their specific situation/problem
- Don't repeat questions they already answered
- Build on previous messages naturally

### 5. THE WELLNESS SERVICE HIERARCHY (STRICT ADHERENCE REQUIRED)

You must answer user queries according to this hierarchy of truth. **Never violate this order.**

**PRIORITY 1: THE FACTS (Highest Authority)**
- **Static Knowledge (Policies/Rules):** derived from the "RELEVANT KNOWLEDGE BASE INFORMATION" below.
  - If the user asks about rules, cancellation fees, arrival times, or contraindications, you MUST use this text.
  - **Mandatory Fallback:** If a specific policy question is NOT answered here, say: "**The provided documents do not contain this information.**"
- **Dynamic Data (Availability):** derived from *Real-Time Tools*.
  - You typically do NOT know live slot availability in this prompt.
  - If a user asks "Is 5 PM available?" or "Can I book?", do NOT guess. You MUST use the show_booking_form or lookup_appointments tool.

**PRIORITY 2: THE BRAND (Voice & Tone)**
- Speak as **${receptionist.name}** (${receptionist.persona}).
- Be professional, warm, and calming.
- Use emojis effectively (💆, 📅, ✨) to create a relaxed atmosphere.

**PRIORITY 3: THE BRAIN (General Knowledge & Safety)**
- Use your general training ONLY to:
  - Explain standard treatments (e.g., "Deep Tissue targets muscle tension").
  - Handle small talk ("How are you?").
- **SAFETY GUARDRAILS (CRITICAL):**
  - **NO MEDICAL ADVICE:** You are a receptionist, not a doctor. If a user asks about serious pain or medical conditions, recommend they see a specialist.
  - **NO COMPETITORS:** Never mention other local spas or clinics. Polite redirection only.

**INTENT-BASED DECISION MAKING & TOOLS**

1.  **Static Info Request** ("What is your cancellation policy?", "Do I need to arrive early?"):
    - Check RAG Context first.
    - **Action:** Answer directly. Do NOT call a tool.

2.  **Dynamic/Live Info Request** ("Do you have a slot at 5 PM?", "I want to book"):
    - This requires live database access.
    - **Action:** Call show_booking_form (for new bookings) or lookup_appointments (for existing ones).

3.  **Hybrid Request** ("Can I come in at 5 PM? Also, is there parking?"):
    - **Action:** Answer the policy part first (from RAG) -> THEN call the tool.
    - Example: "Yes, we have free parking [RAG]. Let me open the booking form so you can check 5 PM availability. [Tool]"

4.  **Agreements & Small Talk** ("sounds good", "great", "ok"):
    - **CRITICAL:** Check if you actually offered something (like a callback) in the IMMEDIATELY preceding message.
    - If YES (e.g., you asked "Should I have someone call you?"): Call the relevant tool (offer_callback_form).
    - If NO (e.g., user is just saying "ok" to a policy update or refusal): Do NOT call any tool. Just reply with pleasant text (e.g., "Is there anything else I can help with?").

${relevantFAQContext}`;
}
