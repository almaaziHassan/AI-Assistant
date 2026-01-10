// Staff interfaces
export interface DailySchedule {
    start: string; // HH:mm
    end: string;   // HH:mm
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
    phone?: string;
    role: string;
    services: string[]; // Array of service IDs this staff can provide
    schedule?: WeeklySchedule; // Specific working hours for this staff
    color?: string;
    isActive: boolean;
    createdAt: string;
}

// Location interfaces
export interface Location {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    isActive: boolean;
    createdAt: string;
}

// Holiday interfaces
export interface Holiday {
    id: string;
    date: string;
    name: string;
    isClosed: boolean;
    customHoursOpen?: string;
    customHoursClose?: string;
    createdAt: string;
}


// Service interfaces
export interface Service {
    id: string;
    name: string;
    description?: string;
    duration: number; // in minutes
    price: number;
    isActive: boolean;
    displayOrder: number;
    createdAt: string;
}

// Analytics interfaces
export interface DashboardStats {
    todayAppointments: number;
    weekAppointments: number;
    monthAppointments: number;
    totalRevenue: number;
    cancelledCount: number;
    upcomingCount: number;
    pendingCallbacksCount: number;
    topServices: { serviceId: string; serviceName: string; count: number }[];
}
