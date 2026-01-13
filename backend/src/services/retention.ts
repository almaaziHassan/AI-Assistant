import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import prisma from '../db/prisma';
import { adminServicePrisma } from './adminPrisma';

interface RetentionState {
    status: 'idle' | 'pending_approval';
    compiledAt: string | null;
    stats: {
        appointments: number;
        callbacks: number;
    };
    archivePath: string | null; // Changed to single archive path
    config: {
        retentionAptDays: number;
        retentionCbDays: number;
    };
}

export class RetentionService {

    // Default retention periods
    private readonly DEFAULT_RETENTION_APPOINTMENTS_DAYS = 1095; // 3 years
    private readonly DEFAULT_RETENTION_CALLBACKS_DAYS = 180;     // 6 months
    private readonly EXPORT_DIR = path.join(process.cwd(), 'data', 'exports');

    constructor() {
        // Ensure export directory exists
        if (!fs.existsSync(this.EXPORT_DIR)) {
            fs.mkdirSync(this.EXPORT_DIR, { recursive: true });
        }
    }

    /**
     * Get the current status from DB (or default)
     */
    async getStatus(): Promise<RetentionState> {
        const setting = await adminServicePrisma.getSystemSetting('retention_state');
        if (setting && setting.value) {
            try {
                // Handle Prisma JSON type
                let val = setting.value;
                if (typeof val === 'string') {
                    val = JSON.parse(val);
                }

                // Check for legacy state format and reset if found
                if ((val as any).filePaths) {
                    console.warn('Retention: Detected legacy state format. Resetting to IDLE.');
                    return this.getDefaultState();
                }

                const state = val as unknown as RetentionState;

                // CRITICAL: Verify file exists. If ephemeral storage wiped it, reset to IDLE.
                if (state.status === 'pending_approval' && state.archivePath) {
                    const fullPath = this.resolvePath(state.archivePath);
                    if (!fs.existsSync(fullPath)) {
                        console.warn('Retention: Pending archive missing from disk (Ephemeral FS reset?). Resetting to IDLE.');
                        const resetState = this.getDefaultState();
                        resetState.config = state.config; // Preserve config
                        await this.saveStatus(resetState);
                        return resetState;
                    }
                }

                return state;
            } catch (e) {
                console.error('Error parsing retention state', e);
                return this.getDefaultState();
            }
        }

        return this.getDefaultState();
    }

    private getDefaultState(): RetentionState {
        return {
            status: 'idle',
            compiledAt: null,
            stats: { appointments: 0, callbacks: 0 },
            archivePath: null,
            config: {
                retentionAptDays: this.DEFAULT_RETENTION_APPOINTMENTS_DAYS,
                retentionCbDays: this.DEFAULT_RETENTION_CALLBACKS_DAYS
            }
        };
    }

    private async saveStatus(state: RetentionState) {
        await adminServicePrisma.setSystemSetting('retention_state', JSON.stringify(state));
    }

    private resolvePath(filePath: string): string {
        if (path.isAbsolute(filePath)) return filePath;
        return path.join(process.cwd(), filePath);
    }

    /**
     * Daily Job: Checks for expired data.
     * If found, compiles Excel archive to disk and sets status = 'pending_approval'
     */
    async checkAndCompile(force: boolean = false): Promise<RetentionState> {
        console.log(`Running Retention Check & Compile... (Force: ${force})`);

        // 1. Get Config
        const retentionAptSetting = await adminServicePrisma.getSystemSetting('retention_appointments_days');
        const retentionCbSetting = await adminServicePrisma.getSystemSetting('retention_callbacks_days');

        const retentionAptDays = retentionAptSetting
            ? parseInt(String(retentionAptSetting.value))
            : this.DEFAULT_RETENTION_APPOINTMENTS_DAYS;
        const retentionCbDays = retentionCbSetting
            ? parseInt(String(retentionCbSetting.value))
            : this.DEFAULT_RETENTION_CALLBACKS_DAYS;

        const aptCutoff = this.getDateDaysAgo(retentionAptDays);
        const cbCutoff = this.getDateDaysAgo(retentionCbDays);

        // 2. Clear previous temp files if status is idle (clean slate)
        const currentState = await this.getStatus();
        if (currentState.status === 'pending_approval' && !force) {
            console.log('Retention Check Skipped: Cleanup already pending approval.');
            return currentState;
        }

        // 3. Find Expired Records
        const expiredAppointments = await prisma.appointment.findMany({
            where: { appointmentDate: { lt: aptCutoff } },
            include: { staff: true, location: true }
        });

        const expiredCallbacks = await prisma.callback.findMany({
            where: {
                status: { in: ['completed', 'no_answer', 'contacted'] },
                createdAt: { lt: cbCutoff }
            }
        });

        const totalRecords = expiredAppointments.length + expiredCallbacks.length;
        if (totalRecords === 0) {
            console.log('Retention Check: No expired records found.');
            const newState = this.getDefaultState();
            newState.compiledAt = new Date().toISOString();
            newState.config = { retentionAptDays, retentionCbDays };
            await this.saveStatus(newState);
            return newState;
        }

        console.log(`Retention Check: Found ${totalRecords} expired records. Compiling Excel Archive...`);

        // 4. Compile Excel Archive
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `archive_${dateStr}.xlsx`;
        const archivePath = path.join(this.EXPORT_DIR, fileName);
        const relativePath = path.join('data', 'exports', fileName);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'AI Receptionist System';
        workbook.created = new Date();

        // Sheet 1: Appointments
        if (expiredAppointments.length > 0) {
            const sheet = workbook.addWorksheet('Appointments');
            sheet.columns = [
                { header: 'Record ID', key: 'id', width: 36 },
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Time', key: 'time', width: 10 },
                { header: 'Customer', key: 'customerName', width: 25 },
                { header: 'Email', key: 'customerEmail', width: 30 },
                { header: 'Phone', key: 'customerPhone', width: 20 },
                { header: 'Service', key: 'serviceName', width: 20 },
                { header: 'Staff', key: 'staffName', width: 20 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Created At', key: 'createdAt', width: 25 }
            ];

            expiredAppointments.forEach(apt => {
                const date = typeof apt.appointmentDate === 'string' ? apt.appointmentDate : apt.appointmentDate.toISOString().split('T')[0];
                const time = typeof apt.appointmentTime === 'string' ? apt.appointmentTime : apt.appointmentTime.toISOString().split('T')[1]?.substring(0, 5) || '00:00';
                sheet.addRow({
                    id: apt.id,
                    date,
                    time,
                    customerName: apt.customerName,
                    customerEmail: apt.customerEmail,
                    customerPhone: apt.customerPhone,
                    serviceName: apt.serviceName,
                    staffName: apt.staffName,
                    status: apt.status,
                    createdAt: apt.createdAt instanceof Date ? apt.createdAt.toISOString() : apt.createdAt
                });
            });
        }

        // Sheet 2: Callbacks
        if (expiredCallbacks.length > 0) {
            const sheet = workbook.addWorksheet('Callbacks');
            sheet.columns = [
                { header: 'Record ID', key: 'id', width: 36 },
                { header: 'Customer', key: 'customerName', width: 25 },
                { header: 'Phone', key: 'customerPhone', width: 20 },
                { header: 'Email', key: 'customerEmail', width: 30 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Concerns', key: 'concerns', width: 40 },
                { header: 'Notes', key: 'notes', width: 40 },
                { header: 'Created At', key: 'createdAt', width: 25 }
            ];

            expiredCallbacks.forEach(cb => {
                sheet.addRow({
                    id: cb.id,
                    customerName: cb.customerName,
                    customerPhone: cb.customerPhone,
                    customerEmail: cb.customerEmail,
                    status: cb.status,
                    concerns: cb.concerns,
                    notes: cb.notes,
                    createdAt: cb.createdAt instanceof Date ? cb.createdAt.toISOString() : cb.createdAt
                });
            });
        }

        await workbook.xlsx.writeFile(archivePath);

        // 5. Update State
        const pendingState: RetentionState = {
            status: 'pending_approval',
            compiledAt: new Date().toISOString(),
            stats: {
                appointments: expiredAppointments.length,
                callbacks: expiredCallbacks.length
            },
            archivePath: relativePath,
            config: { retentionAptDays, retentionCbDays }
        };

        await this.saveStatus(pendingState);
        console.log('Retention Check: Compilation Complete. Waiting for Admin Approval.');
        return pendingState;
    }

    /**
     * Get file path for download
     */
    async getExportFilePath(): Promise<string | null> {
        const state = await this.getStatus();
        if (state.status !== 'pending_approval' || !state.archivePath) return null;
        return this.resolvePath(state.archivePath);
    }

    /**
     * Execute Deletion
     */
    async confirmAndPrune(): Promise<{ success: boolean; deleted: number }> {
        const state = await this.getStatus();
        if (state.status !== 'pending_approval') {
            throw new Error('No cleanup is pending approval.');
        }

        // Re-Verify Cutoffs from State Config to ensure consistency
        const aptCutoff = this.getDateDaysAgo(state.config.retentionAptDays);
        const cbCutoff = this.getDateDaysAgo(state.config.retentionCbDays);

        // Delete from DB
        let totalDeleted = 0;

        // Delete Appointments
        const aptRes = await prisma.appointment.deleteMany({
            where: { appointmentDate: { lt: aptCutoff } }
        });
        totalDeleted += aptRes.count;

        // Delete Callbacks
        const cbRes = await prisma.callback.deleteMany({
            where: {
                status: { in: ['completed', 'no_answer', 'contacted'] },
                createdAt: { lt: cbCutoff }
            }
        });
        totalDeleted += cbRes.count;

        // Delete Archive File
        if (state.archivePath) {
            const fullPath = this.resolvePath(state.archivePath);
            if (fs.existsSync(fullPath)) {
                try {
                    fs.unlinkSync(fullPath);
                } catch (e) {
                    console.error('Failed to delete archive file:', e);
                }
            }
        }

        // Reset State
        const newState = this.getDefaultState();
        newState.config = state.config; // Keep config
        await this.saveStatus(newState);

        return { success: true, deleted: totalDeleted };
    }

    // --- Helpers ---

    private getDateDaysAgo(days: number): Date {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d;
    }
}

export const retentionService = new RetentionService();
