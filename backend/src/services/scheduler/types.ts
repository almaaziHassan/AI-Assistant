export interface Appointment {
    id: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    serviceId: string;
    serviceName: string;
    staffId?: string;
    staffName?: string;
    appointmentDate: string;
    appointmentTime: string;
    duration: number;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TimeSlot {
    time: string;
    available: boolean;
}

export interface BookingRequest {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    serviceId: string;
    staffId: string;  // Required - must select a staff member
    date: string;
    time: string;
    notes?: string;
}
