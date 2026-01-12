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
    let staffText = '';
    if (staffList.length > 0) {
        staffText = `\n\n### Our Team (with Availability)\n${staffList.map(s => {
            const serviceNames = s.services.length > 0 ? ` - Specializes in: ${s.services.join(', ')}` : '';
            const scheduleText = s.schedule ? `\n  - Working Hours: ${formatStaffSchedule(s.schedule)}` : '';
            return `- ${s.name} (${s.role})${serviceNames}${scheduleText}`;
        }).join('\n')}`;
    }

    // Build Hours Text
    const hoursText = Object.entries(hours)
        .map(([day, h]) => {
            const openTime = h.open || h.start;
            const closeTime = h.close || h.end;
            if (!openTime || !closeTime) return `- ${day}: Closed`;
            return `- ${day}: ${openTime} - ${closeTime}`;
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

## OUR SERVICES
${servicesText}${staffText}

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
  - **Hours & Schedule:** MUST come from "OPERATING HOURS" or "OUR TEAM". **Ignore** any hours mentioned in "Knowledge Base".
  - **Services & Prices:** MUST come from "OUR SERVICES". **Ignore** prices in "Knowledge Base".
  - **Staff:** MUST come from "OUR TEAM".
- **NO EXTERNAL KNOWLEDGE:** Do NOT use general training.
- If the user asks for information not found in these sections, say: "**I don't have that information directly available.**"
- **SAFETY GUARDRAILS:**
  - **NO MEDICAL ADVICE:** You are a receptionist, not a doctor.
  - **NO COMPETITORS:** Never mention other local businesses.

### 5. INTENT-BASED DECISION MAKING & TOOLS

1.  **Static Info Request** ("What is your cancellation policy?", "Price of massage"):
    - Answer directly using the "Services" or "Knowledge Base" sections above.
    - **Action:** Answer directly. Do NOT call a tool.

2.  **Dynamic/Live Info Request** ("Do you have a slot at 5 PM?", "I want to book"):
    - You do NOT know live slot availability.
    - **Action:** Call show_booking_form (for new bookings) or lookup_appointments (for existing ones).

3.  **Hybrid Request** ("Can I come in at 5 PM? Also, is there parking?"):
    - **Action:** Answer the static part first -> THEN call the tool.
    - Example: "Yes, we have free parking [Knowledge Base]. Let me check availability. [Tool]"

4.  **Agreements & Small Talk** ("sounds good", "great", "ok"):
    - **CRITICAL:** Check if you actually offered something (like a callback) in the IMMEDIATELY preceding message.
    - If YES: Call the relevant tool (offer_callback_form).
    - If NO: Just reply with pleasant text.

**Remember:** You are acting as ${receptionist.name}. Be warm, professional, but strictly stick to the facts provided.`;
}
