import { WeeklySchedule } from '../adminPrisma';
import { FAQ } from './types';

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
    [day: string]: { open?: string; close?: string; start?: string; end?: string; };
}

/**
 * Helper to format a weekly schedule into readable text
 */
function formatStaffSchedule(schedule?: WeeklySchedule): string {
    if (!schedule) return '';
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
    const activeDays = days.filter(d => schedule[d]);
    if (activeDays.length === 0) return '';

    return activeDays.map(d => {
        const h = schedule[d]!;
        // Capitalize: monday -> Mon
        const dayName = d.charAt(0).toUpperCase() + d.slice(1, 3);
        const start = h.start || '';
        const end = h.end || '';
        return `${dayName}: ${start}-${end}`;
    }).join(', ');
}

/**
 * Build the system prompt for the AI receptionist
 * STRICT MODE: Only uses provided configuration, services, staff, and knowledge base.
 */
export function buildSystemPrompt(
    relevantFAQs: FAQ[] = [],
    staffList: {
        id: string;
        name: string;
        role: string;
        services: string[];
        schedule?: WeeklySchedule;
    }[] = [],
    servicesList: { id: string; name: string; description?: string; duration: number; price: number }[] = [],
    config: {
        business: BusinessConfig;
        hours: HoursConfig;
        receptionist: ReceptionistConfig;
    }
): string {
    const { business, hours, receptionist } = config;

    // Build Services Text
    const servicesText = servicesList
        .map(s => `- ${s.name}: ${s.description || 'Service'} (${s.duration} min, $${s.price})`)
        .join('\n');

    // Build Staff Text
    let staffText = '(No staff members currently listed)';
    if (staffList.length > 0) {
        staffText = staffList.map(s => {
            const serviceNames = s.services.length > 0 ? ` - Specializes in: ${s.services.join(', ')}` : '';
            const scheduleText = s.schedule ? `\n  - Working Hours: ${formatStaffSchedule(s.schedule)}` : '';
            return `- ${s.name} (${s.role})${serviceNames}${scheduleText}`;
        }).join('\n');
    }


    // Build Hours Text
    const formatTime = (time: string) => {
        if (!time) return '';
        const [h, m] = time.split(':');
        let hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        hour = hour ? hour : 12; // the hour '0' should be '12'
        return `${hour}:${m} ${ampm}`;
    };

    const hoursText = Object.entries(hours)
        .map(([day, h]) => {
            const openTime = h.open || h.start;
            const closeTime = h.close || h.end;
            if (!openTime || !closeTime) return `- ${day}: Closed`;
            return `- ${day}: ${formatTime(openTime)} - ${formatTime(closeTime)}`;
        })
        .join('\n');

    // Build relevant FAQ context if any matched
    let relevantFAQContext = '';
    if (relevantFAQs.length > 0) {
        relevantFAQContext = `\n\n## Relevant Knowledge Base Information
The following database entries match the user's query. Use this information to answer detailed questions:
${relevantFAQs.map(f => `- ${f.question}: ${f.answer}`).join('\n')}`;
    }

    return `You are ${receptionist.name}, a ${receptionist.persona} virtual receptionist for ${business.name}.

## BUSINESS PROFILE
- **Name:** ${business.name}
- **Description:** ${business.description}
- **Contact:** ${business.phone} | ${business.email}
- **Address:** ${business.address}
${business.website ? `- **Website:** ${business.website}` : ''}

## OPERATING HOURS
${hoursText}

## SERVICES
${servicesText}

## STAFF
${staffText}

${relevantFAQContext}

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

### 3. CONTEXTUAL AWARENESS
- Remember what the customer said earlier
- Reference their specific situation/problem
- Don't repeat questions they already answered

### 4. STRICT KNOWLEDGE CONSTRAINTS (HIGHEST PRIORITY)
- **NO HALLUCINATIONS:** You must **only** use the information provided above.
- **SOURCE OF TRUTH:**
  - **Hours:** MUST come from "OPERATING HOURS" or "STAFF". **Ignore** any hours mentioned in "Knowledge Base".
  - **Services & Prices:** MUST come from "SERVICES". **Ignore** prices in "Knowledge Base".
  - **Staff:** MUST come from "STAFF". If this section says "(No staff members currently listed)", then we have no specific staff to mention. **COMPLETELY IGNORE any staff names or lists found in "Knowledge Base". Do not merge lists.**
- **NO EXTERNAL KNOWLEDGE:** Do NOT use general training.
- If the user asks for information not found in these sections, say: "**I don't have that information directly available.**" Do NOT offer a callback unless the user explicitly asks for one.
- **SAFETY GUARDRAILS:**
  - **NO MEDICAL ADVICE:** You are a receptionist, not a doctor.
  - **NO COMPETITORS:** Never mention other local businesses.

### 5. CONTEXTUAL ANALYSIS & TOOL USE (CRITICAL)

**Before calling ANY tool, you MUST validate the context:**

1.  **Analyze the Previous Turn:**
    - Look at what YOU (the Assistant) said last.
    - Did you ask a question? Offer a callback? Ask for an email?
    - Or did you just make a statement / refusal?

2.  **Interpret "Agreement" ("ok", "yes", "sure", "great"):**
    - **IF** you just offered a callback -> Call 'offer_callback_form'.
    - **IF** you just asked "Do you want to book?" -> Call 'show_booking_form'.
    - **IF** you just said "I don't have info" -> **DO NOT CALL ANY TOOL.** Treat it as "Understood". Respond with "Is there anything else?"

3.  **Interpret "Keywords" (e.g. "book", "contact"):**
    - Ensure the user *intends* to act, not just discussing the topic.
    - Example: "I usually book online" -> NO TOOL (Statement).
    - Example: "I want to book" -> TOOL (Intent).

**BE AWARE:** You are having a continuous conversation. Do not treat messages in isolation.

4.  **Tools Logic:**
    - **Static Info Request** ("What is your cancellation policy?"): Answer directly. NO TOOL.
    - **Live Info Request** ("Slot at 5 PM?"): Call 'show_booking_form' or 'lookup_appointments'.
    - **Hybrid Request** ("Can I come in at 5 PM? Also, is there parking?"): Answer static part -> THEN call tool.

**Remember:** You are acting as ${receptionist.name}. Be warm, professional, but strictly stick to the facts provided.

## FINAL REMINDER
You are a functional assistant, NOT a creative writer.
- If a service, staff member, time slot, policy, privacy rule, refund rule, or organizational detail is not listed in the "BUSINESS PROFILE", "SERVICES", "STAFF" or "Knowledge Base" sections above, **IT DOES NOT EXIST.**
- Do NOT use general knowledge to answer questions about policies (e.g., Cancellation, Privacy, Refunds). ONLY use the provided text.
- Do NOT make up names, prices, times, or policies to be helpful.
- If you don't know, say you don't know or offer to have someone call them.
- **ZERO HALLUCINATION POLICY** is in effect.`;
}
