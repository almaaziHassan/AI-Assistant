
import prisma from '../src/db/prisma';
import fs from 'fs';

async function debugRetention() {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: 'retention_state' }
        });

        if (!setting || !setting.value) {
            console.log('No retention_state setting found.');
            return;
        }

        // Handle potential double stringification if any
        let state = setting.value;
        if (typeof state === 'string') {
            try { state = JSON.parse(state); } catch { }
        }

        console.log('--- CHECKING FILES ---');
        console.log(`Current process.cwd(): ${process.cwd()}`);

        // @ts-ignore
        if (state.filePaths) {
            // @ts-ignore
            const aptPath = state.filePaths.appointments;
            // @ts-ignore
            const cbPath = state.filePaths.callbacks;

            if (aptPath) {
                const exists = fs.existsSync(aptPath);
                console.log(`[APPT] Path: "${aptPath}"`);
                console.log(`[APPT] Exists? ${exists}`);
            } else {
                console.log('[APPT] Path is null');
            }

            if (cbPath) {
                const exists = fs.existsSync(cbPath);
                console.log(`[CB] Path: "${cbPath}"`);
                console.log(`[CB] Exists? ${exists}`);
            } else {
                console.log('[CB] Path is null');
            }
        } else {
            console.log('No filePaths in state');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

debugRetention();
