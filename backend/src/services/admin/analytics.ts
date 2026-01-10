import { getOne, getAll, SqlValue } from '../../db/database';
import { DashboardStats } from './types';

export function getDashboardStats(): DashboardStats {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Business timezone for upcoming calculations
    const nowUTC = new Date();
    const businessOffset = 5 * 60; // PKT is UTC+5 (in minutes)
    const businessTime = new Date(nowUTC.getTime() + businessOffset * 60 * 1000);
    const businessDate = businessTime.toISOString().split('T')[0];
    const currentTime = businessTime.toTimeString().slice(0, 5);

    // OPTIMIZED: Single combined query for all appointment stats
    const statsResult = getOne(
        `SELECT 
        SUM(CASE WHEN appointment_date = ? AND status IN('confirmed', 'completed') THEN 1 ELSE 0 END) as today_count,
        SUM(CASE WHEN appointment_date >= ? AND status IN('confirmed', 'completed') THEN 1 ELSE 0 END) as week_count,
        SUM(CASE WHEN appointment_date >= ? AND status IN('confirmed', 'completed') THEN 1 ELSE 0 END) as month_count,
        SUM(CASE WHEN appointment_date >= ? AND status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(CASE WHEN status IN('pending', 'confirmed') AND (appointment_date > ? OR (appointment_date = ? AND appointment_time > ?)) THEN 1 ELSE 0 END) as upcoming_count
      FROM appointments`,
        [today, weekAgo, monthAgo, monthAgo, businessDate, businessDate, currentTime]
    );

    const todayAppointments = Number(statsResult?.today_count) || 0;
    const weekAppointments = Number(statsResult?.week_count) || 0;
    const monthAppointments = Number(statsResult?.month_count) || 0;
    const cancelledCount = Number(statsResult?.cancelled_count) || 0;
    const upcomingCount = Number(statsResult?.upcoming_count) || 0;

    // Pending callbacks count - separate query (different table)
    const callbacksResult = getOne(
        `SELECT COUNT(*) as count FROM callbacks WHERE status = 'pending'`
    );
    const pendingCallbacksCount = (callbacksResult?.count as number) || 0;

    // Top services - separate query (requires GROUP BY)
    const topServicesRows = getAll(
        `SELECT service_id, service_name, COUNT(*) as count
       FROM appointments
       WHERE appointment_date >= ?
       GROUP BY service_id, service_name
       ORDER BY count DESC
       LIMIT 5`,
        [monthAgo]
    );
    const topServices = topServicesRows.map(row => ({
        serviceId: row.service_id as string,
        serviceName: row.service_name as string,
        count: row.count as number
    }));

    // Total revenue (simplified - just count * average price)
    const totalRevenue = monthAppointments * 100; // Placeholder

    return {
        todayAppointments,
        weekAppointments,
        monthAppointments,
        totalRevenue,
        cancelledCount,
        upcomingCount,
        pendingCallbacksCount,
        topServices
    };
}

export function getAppointmentsForDateRange(startDate: string, endDate: string): Record<string, unknown>[] {
    return getAll(
        `SELECT * FROM appointments
       WHERE appointment_date >= ? AND appointment_date <= ?
  ORDER BY appointment_date, appointment_time`,
        [startDate, endDate]
    );
}

export function getAllAppointments(options: { status?: string; limit?: number; offset?: number } = {}): Record<string, unknown>[] {
    let query = 'SELECT * FROM appointments';
    const params: SqlValue[] = [];

    if (options.status) {
        query += ' WHERE status = ?';
        params.push(options.status);
    }

    query += ' ORDER BY appointment_date ASC, appointment_time ASC';

    if (options.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
        if (options.offset) {
            query += ' OFFSET ?';
            params.push(options.offset);
        }
    }

    return getAll(query, params);
}
