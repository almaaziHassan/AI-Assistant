import { getAll, getOne } from '../../db/database';
import { Appointment } from './types';
import { STATS_PERIODS } from '../../constants/business';
import { getDaysAgoISO } from '../../constants/time';

export function rowToAppointment(row: Record<string, unknown>): Appointment {
    return {
        id: row.id as string,
        customerName: row.customer_name as string,
        customerEmail: row.customer_email as string,
        customerPhone: row.customer_phone as string,
        serviceId: row.service_id as string,
        serviceName: row.service_name as string,
        staffId: row.staff_id as string | undefined,
        staffName: row.staff_name as string | undefined,
        appointmentDate: row.appointment_date as string,
        appointmentTime: row.appointment_time as string,
        duration: row.duration as number,
        status: row.status as Appointment['status'],
        notes: row.notes as string | undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string
    };
}

export function getAppointment(id: string): Appointment | null {
    const row = getOne('SELECT * FROM appointments WHERE id = ?', [id]);

    if (!row) return null;

    return rowToAppointment(row);
}

export function getAppointmentsByEmail(email: string): Appointment[] {
    const rows = getAll(
        'SELECT * FROM appointments WHERE customer_email = ? ORDER BY appointment_date, appointment_time',
        [email.toLowerCase()]
    );

    return rows.map(row => rowToAppointment(row));
}

export function getAppointmentsByDate(date: string): Appointment[] {
    const rows = getAll(
        'SELECT * FROM appointments WHERE appointment_date = ? ORDER BY appointment_time',
        [date]
    );

    return rows.map(row => rowToAppointment(row));
}

export function getAppointmentsNeedingAction(): Appointment[] {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Get appointments where:
    // 1. Status is 'confirmed' AND
    // 2. (Date is before today) OR (Date is today AND appointment end time has passed)
    const rows = getAll(
        `SELECT * FROM appointments
     WHERE status = 'confirmed'
     AND (
       appointment_date < ?
       OR (appointment_date = ? AND time(appointment_time, '+' || duration || ' minutes') <= time(?))
     )
     ORDER BY appointment_date DESC, appointment_time DESC`,
        [today, today, currentTime]
    );

    return rows.map(row => rowToAppointment(row));
}

export function getAppointmentStats(): {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
    noShowRate: number;
} {
    // All-time stats
    const stats = getOne(
        `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END) as no_show
     FROM appointments`
    ) as { total: number; pending: number; confirmed: number; completed: number; cancelled: number; no_show: number };

    // No-show rate for last 30 days only
    const monthAgo = getDaysAgoISO(STATS_PERIODS.LAST_MONTH_DAYS);
    const monthStats = getOne(
        `SELECT
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END) as no_show
     FROM appointments WHERE appointment_date >= ?`,
        [monthAgo]
    ) as { completed: number; no_show: number } | undefined;

    const completed30d = monthStats?.completed || 0;
    const noShow30d = monthStats?.no_show || 0;
    const finishedAppointments30d = completed30d + noShow30d;
    const noShowRate = finishedAppointments30d > 0
        ? Math.round((noShow30d / finishedAppointments30d) * 100)
        : 0;

    return {
        total: stats.total,
        pending: stats.pending,
        confirmed: stats.confirmed,
        completed: stats.completed,
        cancelled: stats.cancelled,
        noShow: stats.no_show,
        noShowRate
    };
}
