import fs from 'fs';
import path from 'path';
import prisma from '../db/prisma';
import { adminServicePrisma } from './adminPrisma';

interface RetentionState {
    status: 'idle' | 'pending_approval';
    compiledAt: string | null;
    stats: {
        appointments: number;
        callbacks: number;
    };
    filePaths: {
        appointments: string | null;
        callbacks: string | null;
    };
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

                const state = val as unknown as RetentionState;

                // CRITICAL: Verify files exist. If ephemeral storage wiped them, reset to IDLE.
                if (state.status === 'pending_approval') {
                    const aptMissing = state.filePaths.appointments && !fs.existsSync(this.resolvePath(state.filePaths.appointments));
                    const cbMissing = state.filePaths.callbacks && !fs.existsSync(this.resolvePath(state.filePaths.callbacks));

                    if (aptMissing || cbMissing) {
                        console.warn('Retention: Pending files missing from disk (Ephemeral FS reset?). Resetting to IDLE.');

                        const resetState: RetentionState = {
                            status: 'idle',
                            compiledAt: null,
                            stats: { appointments: 0, callbacks: 0 },
                            filePaths: { appointments: null, callbacks: null },
                            config: state.config
                        };

                        // Self-heal DB
                        await this.saveStatus(resetState);
                        return resetState;
                    }
                }

                return state;
            } catch (e) { console.error('Error parsing retention state', e); }
        }

        // Default State
        return {
            status: 'idle',
            compiledAt: null,
            stats: { appointments: 0, callbacks: 0 },
            filePaths: { appointments: null, callbacks: null },
            config: { retentionAptDays: 0, retentionCbDays: 0 }
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
     * If found, compiles CSVs to disk and sets status = 'pending_approval'
     */
    /**
     * Daily Job: Checks for expired data.
     * If found, compiles CSVs to disk and sets status = 'pending_approval'
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

        const aptCutoff = new Date();
        aptCutoff.setDate(aptCutoff.getDate() - retentionAptDays);
        const cbCutoff = new Date();
        cbCutoff.setDate(cbCutoff.getDate() - retentionCbDays);

        // 2. Clear previous temp files if status is idle (clean slate)
        // If status is pending_approval, WE DO NOT OVERWRITE unless forced.
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
            const newState: RetentionState = {
                status: 'idle',
                compiledAt: new Date().toISOString(),
                stats: { appointments: 0, callbacks: 0 },
                filePaths: { appointments: null, callbacks: null },
                config: { retentionAptDays, retentionCbDays }
            };
            await this.saveStatus(newState);
            return newState;
        }

        console.log(`Retention Check: Found ${totalRecords} expired records. Compiling...`);

        // 4. Compile CSVs
        const dateStr = new Date().toISOString().split('T')[0];
        let aptFilePath: string | null = null;
        let cbFilePath: string | null = null;
        let aptRelativePath: string | null = null;
        let cbRelativePath: string | null = null;

        if (expiredAppointments.length > 0) {
            const csv = this.generateAppointmentCSV(expiredAppointments);
            const fileName = `appointments_archive_${dateStr}.csv`;
            aptFilePath = path.join(this.EXPORT_DIR, fileName);
            aptRelativePath = path.join('data', 'exports', fileName);
            fs.writeFileSync(aptFilePath, csv);
        }

        if (expiredCallbacks.length > 0) {
            const csv = this.generateCallbackCSV(expiredCallbacks);
            const fileName = `callbacks_archive_${dateStr}.csv`;
            cbFilePath = path.join(this.EXPORT_DIR, fileName);
            cbRelativePath = path.join('data', 'exports', fileName);
            fs.writeFileSync(cbFilePath, csv);
        }

        // 5. Update State (Store RELATIVE paths for better portability)
        const pendingState: RetentionState = {
            status: 'pending_approval',
            compiledAt: new Date().toISOString(),
            stats: {
                appointments: expiredAppointments.length,
                callbacks: expiredCallbacks.length
            },
            filePaths: {
                appointments: aptRelativePath, // Store relative
                callbacks: cbRelativePath      // Store relative
            },
            config: { retentionAptDays, retentionCbDays }
        };

        await this.saveStatus(pendingState);
        console.log('Retention Check: Compilation Complete. Waiting for Admin Approval.');
        return pendingState;
    }

    /**
     * Get file path for download
     */
    /**
     * Get file path for download
     */
    async getExportFilePath(type: 'appointments' | 'callbacks'): Promise<string | null> {
        const state = await this.getStatus();
        if (state.status !== 'pending_approval') return null;

        const storedPath = type === 'appointments' ? state.filePaths.appointments : state.filePaths.callbacks;
        if (!storedPath) return null;

        return this.resolvePath(storedPath);
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
        const aptCutoff = new Date();
        aptCutoff.setDate(aptCutoff.getDate() - state.config.retentionAptDays);
        const cbCutoff = new Date();
        cbCutoff.setDate(cbCutoff.getDate() - state.config.retentionCbDays);

        // Delete from DB
        let totalDeleted = 0;

        if (state.filePaths.appointments) {
            // Safety: Only delete if date matches cutoff logic
            const res = await prisma.appointment.deleteMany({
                where: { appointmentDate: { lt: aptCutoff } }
            });
            totalDeleted += res.count;
            // Delete file
            if (fs.existsSync(state.filePaths.appointments)) fs.unlinkSync(state.filePaths.appointments);
        }

        if (state.filePaths.callbacks) {
            const res = await prisma.callback.deleteMany({
                where: {
                    status: { in: ['completed', 'no_answer', 'contacted'] },
                    createdAt: { lt: cbCutoff }
                }
            });
            totalDeleted += res.count;
            if (fs.existsSync(state.filePaths.callbacks)) fs.unlinkSync(state.filePaths.callbacks);
        }

        // Reset State
        const newState: RetentionState = {
            status: 'idle',
            compiledAt: new Date().toISOString(),
            stats: { appointments: 0, callbacks: 0 },
            filePaths: { appointments: null, callbacks: null },
            config: state.config
        };
        await this.saveStatus(newState);

        return { success: true, deleted: totalDeleted };
    }

    // --- Helpers ---

    private generateAppointmentCSV(data: any[]): string {
        const header = 'ID,Date,Time,Customer,Email,Phone,Service,Staff,Status,Created At\n';
        const rows = data.map(row => {
            const date = typeof row.appointmentDate === 'string' ? row.appointmentDate : row.appointmentDate.toISOString().split('T')[0];
            const time = typeof row.appointmentTime === 'string' ? row.appointmentTime : row.appointmentTime.toISOString().split('T')[1]?.substring(0, 5) || '00:00';
            const escape = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;

            return [
                escape(row.id),
                escape(date),
                escape(time),
                escape(row.customerName),
                escape(row.customerEmail),
                escape(row.customerPhone),
                escape(row.serviceName),
                escape(row.staffName),
                escape(row.status),
                escape(row.createdAt)
            ].join(',');
        });
        return header + rows.join('\n');
    }

    private generateCallbackCSV(data: any[]): string {
        const header = 'ID,Customer,Phone,Email,Status,Concerns,Notes,Created At\n';
        const rows = data.map(row => {
            const escape = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
            return [
                escape(row.id),
                escape(row.customerName),
                escape(row.customerPhone),
                escape(row.customerEmail),
                escape(row.status),
                escape(row.concerns),
                escape(row.notes),
                escape(row.createdAt)
            ].join(',');
        });
        return header + rows.join('\n');
    }
}

export const retentionService = new RetentionService();
