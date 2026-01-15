/**
 * CRM Service
 * 
 * Aggregates customer data into a unified "Contact" view.
 * Handles logic for merging Users (registered) and Guests (email-only).
 */

import prisma from '../db/prisma';
import { Prisma } from '@prisma/client';
import { emailService } from './email';

export interface CustomerStats {
    totalSpend: number;
    totalVisits: number;
    noShowCount: number;
    lastVisitDate: Date | null;
    reliabilityScore: number; // 0-100
}

export interface ContactListItem {
    id: string; // ContactProfile ID
    name: string;
    email: string;
    phone?: string;
    type: 'user' | 'guest';
    tags: string[];
    isBlocked: boolean;
    stats: CustomerStats;
    lastSeenAt: Date | null;
}

export interface TimelineEvent {
    id: string;
    type: 'appointment' | 'chat' | 'callback' | 'note';
    date: Date;
    title: string;
    description?: string;
    details?: any; // Payload for the UI
    icon?: string;
    status?: string;
}

export interface CustomerDetail {
    profile: ContactListItem;
    timeline: TimelineEvent[];
    notes: string | null;
}

export class CRMService {

    /**
     * Get paginated contacts list with search/filter
     */
    async getContacts(
        page: number = 1,
        limit: number = 20,
        search?: string,
        filter?: 'vip' | 'at-risk' | 'all'
    ): Promise<{ contacts: ContactListItem[], total: number }> {
        const offset = (page - 1) * limit;

        const where: Prisma.ContactProfileWhereInput = {};

        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                {
                    user: {
                        name: { contains: search, mode: 'insensitive' }
                    }
                }
            ];
        }

        if (filter === 'vip') {
            where.tags = { array_contains: 'vip' };
        }

        const [profiles, total] = await Promise.all([
            prisma.contactProfile.findMany({
                where,
                take: limit,
                skip: offset,
                include: { user: true },
                orderBy: { lastSeenAt: 'desc' }
            }),
            prisma.contactProfile.count({ where })
        ]);

        const contacts = await Promise.all(profiles.map(async (profile) => {
            const stats = await this.calculateCustomerStats(profile.email);
            const name = profile.user?.name || await this.guessNameFromAppointments(profile.email) || 'Guest User';

            return {
                id: profile.id,
                name: name,
                email: profile.email,
                phone: profile.phone || profile.user?.phone,
                type: profile.userId ? 'user' : 'guest',
                tags: (profile.tags as string[]) || [],
                isBlocked: profile.isBlocked,
                lastSeenAt: profile.lastSeenAt,
                stats
            } as ContactListItem;
        }));

        return { contacts, total };
    }

    /**
     * Get full details for a single customer (by ContactProfile ID or Email)
     */
    async getCustomerDetails(idOrEmail: string): Promise<CustomerDetail | null> {
        const profile = await prisma.contactProfile.findFirst({
            where: {
                OR: [
                    { id: idOrEmail },
                    { email: idOrEmail.toLowerCase() }
                ]
            },
            include: { user: true }
        });

        if (!profile) return null;

        const stats = await this.calculateCustomerStats(profile.email);
        const name = profile.user?.name || await this.guessNameFromAppointments(profile.email) || 'Guest User';
        const timeline = await this.buildTimeline(profile.email, profile.userId || undefined);

        return {
            profile: {
                id: profile.id,
                name: name,
                email: profile.email,
                phone: profile.phone || profile.user?.phone,
                type: profile.userId ? 'user' : 'guest',
                tags: (profile.tags as string[]) || [],
                isBlocked: profile.isBlocked,
                lastSeenAt: profile.lastSeenAt,
                stats
            } as ContactListItem,
            timeline,
            notes: profile.notes
        };
    }

    // ================= HELPER METHODS =================

    private async calculateCustomerStats(email: string): Promise<CustomerStats> {
        const appointments = await prisma.appointment.findMany({
            where: { customerEmail: email.toLowerCase() },
            select: { status: true, appointmentDate: true, serviceId: true }
        });

        const totalVisits = appointments.filter(a => a.status === 'completed').length;
        const noShowCount = appointments.filter(a => a.status === 'no-show').length;

        const totalBooked = appointments.length;
        const reliabilityScore = totalBooked > 0
            ? Math.round(100 - ((noShowCount / totalBooked) * 100))
            : 100;

        const completed = appointments.filter(a => a.status === 'completed' || a.status === 'confirmed');
        const lastVisitDate = completed.length > 0
            ? completed.sort((a, b) => b.appointmentDate.getTime() - a.appointmentDate.getTime())[0].appointmentDate
            : null;

        const totalSpend = totalVisits * 50;

        return { totalSpend, totalVisits, noShowCount, lastVisitDate, reliabilityScore };
    }

    private async guessNameFromAppointments(email: string): Promise<string | null> {
        const apt = await prisma.appointment.findFirst({
            where: { customerEmail: email },
            select: { customerName: true },
            orderBy: { createdAt: 'desc' }
        });
        return apt?.customerName || null;
    }

    private async buildTimeline(email: string, userId?: string): Promise<TimelineEvent[]> {
        const events: TimelineEvent[] = [];

        const appointments = await prisma.appointment.findMany({
            where: { customerEmail: email },
            orderBy: { appointmentDate: 'desc' },
            take: 20
        });

        appointments.forEach(apt => {
            // Combine date and time for accurate display
            let eventDate = apt.appointmentDate;
            if (apt.appointmentTime) {
                const timeObj = apt.appointmentTime as unknown as Date;
                const timeStr = timeObj instanceof Date
                    ? `${timeObj.getUTCHours().toString().padStart(2, '0')}:${timeObj.getUTCMinutes().toString().padStart(2, '0')}`
                    : String(timeObj).substring(0, 5);
                // Create combined datetime
                const dateStr = apt.appointmentDate.toISOString().split('T')[0];
                eventDate = new Date(`${dateStr}T${timeStr}:00`);
            }

            events.push({
                id: apt.id,
                type: 'appointment',
                date: eventDate,
                title: `${apt.status === 'completed' ? 'Visited' : 'Booked'}: ${apt.serviceName}`,
                description: `Status: ${apt.status} - Notes: ${apt.notes || 'None'}`,
                status: apt.status || 'unknown',
                details: apt
            });
        });

        if (userId) {
            const chats = await prisma.conversation.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10
            });
            chats.forEach(msg => {
                events.push({
                    id: msg.id,
                    type: 'chat',
                    date: msg.createdAt || new Date(),
                    title: `Chat (${msg.role})`,
                    description: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
                    details: msg
                });
            });
        }

        const callbacks = await prisma.callback.findMany({
            where: {
                OR: [
                    { customerEmail: email },
                ]
            },
            take: 10
        });

        callbacks.forEach(cb => {
            events.push({
                id: cb.id,
                type: 'callback',
                date: cb.createdAt || new Date(),
                title: `Callback Requested`,
                description: `Status: ${cb.status} - Concerns: ${cb.concerns || 'None'}`,
                details: cb
            });
        });

        return events.sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    /**
     * Re-calculate tags based on behavior
     * - "VIP": > $500 spend
     * - "Ghost": >= 2 no-shows
     */
    private async refreshAutoTags(email: string): Promise<void> {
        const stats = await this.calculateCustomerStats(email);
        const profile = await prisma.contactProfile.findUnique({ where: { email } });
        if (!profile) return;

        let currentTags = (profile.tags as string[]) || [];

        // Remove auto-tags to re-evaluate
        currentTags = currentTags.filter(t => t !== 'VIP' && t !== 'Ghost');

        // Apply rules
        if (stats.totalSpend > 500) currentTags.push('VIP');
        if (stats.noShowCount >= 2) currentTags.push('Ghost');

        // Update if changed
        // (Simple JSON comparison or set check)
        const newTagsInfo = JSON.stringify(currentTags.sort());
        const oldTagsInfo = JSON.stringify(((profile.tags as string[]) || []).filter(t => t !== 'VIP' && t !== 'Ghost').concat(
            stats.totalSpend > 500 ? ['VIP'] : [],
            stats.noShowCount >= 2 ? ['Ghost'] : []
        ).sort());

        // Optimization: In a real app we'd compare better, but Prisma update is cheap enough for now
        await prisma.contactProfile.update({
            where: { email },
            data: { tags: currentTags }
        });
    }

    async syncContacts() {
        // 1. Sync Registered Users
        const users = await prisma.user.findMany({ select: { id: true, email: true, phone: true } });
        for (const u of users) {
            await prisma.contactProfile.upsert({
                where: { email: u.email },
                create: {
                    email: u.email,
                    userId: u.id,
                    phone: u.phone,
                    lastSeenAt: new Date()
                },
                update: { userId: u.id }
            });
        }

        // 2. Sync Guests from Appointments
        const appointments = await prisma.appointment.groupBy({
            by: ['customerEmail'],
        });

        for (const apt of appointments) {
            await prisma.contactProfile.upsert({
                where: { email: apt.customerEmail },
                create: {
                    email: apt.customerEmail,
                    lastSeenAt: new Date(),
                },
                update: {}
            });
        }

        // 3. Trigger Auto-Tagging for everyone
        const allProfiles = await prisma.contactProfile.findMany({ select: { email: true } });
        for (const p of allProfiles) {
            await this.refreshAutoTags(p.email);
        }

        return { count: allProfiles.length };
    }

    async updateProfile(id: string, data: { notes?: string, tags?: string[], isBlocked?: boolean }) {
        return prisma.contactProfile.update({
            where: { id },
            data
        });
    }

    /**
     * Broadcast Marketing Email
     * Sends to all filtered users
     */
    async sendBroadcast(segment: 'all' | 'vip' | 'guests', subject: string, message: string) {
        let where: Prisma.ContactProfileWhereInput = {};

        if (segment === 'vip') {
            where.tags = { array_contains: 'VIP' };
        } else if (segment === 'guests') {
            where.userId = null;
        }
        // 'all' needs no filter

        const targets = await prisma.contactProfile.findMany({ where });
        const results = { sent: 0, failed: 0 };

        // We use the email service directly
        // const { emailService } = await import('./email');

        // In production, use a Queue (BullMQ). Here we just loop (parallel limit recommended).
        for (const t of targets) {
            const success = await emailService.sendEmail({
                to: t.email,
                subject,
                html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
                text: message
            });
            if (success) results.sent++;
            else results.failed++;
        }

        return results;
    }
}

export const crmService = new CRMService();
