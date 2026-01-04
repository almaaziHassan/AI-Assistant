export interface DashboardStats {
    todayAppointments: number;
    weekAppointments: number;     // Confirmed only
    monthAppointments: number;    // Confirmed only
    totalRevenue: number;
    cancelledCount: number;
    upcomingCount: number;
    pendingCallbacksCount: number;
    noShowCount: number;          // No-shows this month
    topServices: { serviceId: string; serviceName: string; count: number }[];
}

export interface AppointmentStats {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
    noShowRate: number;
}

export interface Appointment {
    id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    service_name: string;
    staff_name?: string;
    appointment_date: string;
    appointment_time: string;
    duration: number;
    status: string;
    created_at: string;
}

export interface DailySchedule {
    start: string;
    end: string;
}

export interface WeeklySchedule {
    monday: DailySchedule | null;
    tuesday: DailySchedule | null;
    wednesday: DailySchedule | null;
    thursday: DailySchedule | null;
    friday: DailySchedule | null;
    saturday: DailySchedule | null;
    sunday: DailySchedule | null;
}

export interface Staff {
    id: string;
    name: string;
    email?: string;
    role: string;
    services?: string[];
    schedule?: WeeklySchedule;
    isActive: boolean;
}

export interface Service {
    id: string;
    name: string;
    description?: string;
    duration: number;
    price: number;
    isActive: boolean;
}

export interface Holiday {
    id: string;
    date: string;
    name: string;
    isClosed: boolean;
    customHoursOpen?: string;
    customHoursClose?: string;
}

export interface CallbackRequest {
    id: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    preferredTime?: string;
    concerns?: string;
    status: 'pending' | 'contacted' | 'completed' | 'no_answer';
    notes?: string;
    calledAt?: string;
    createdAt: string;
}
