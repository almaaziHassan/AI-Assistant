import prisma from '../src/db/prisma';

async function seedRetentionSettings() {
    console.log('Seeding retention settings...');

    await prisma.systemSetting.upsert({
        where: { key: 'retention_appointments_days' },
        update: {},
        create: {
            key: 'retention_appointments_days',
            value: '1095', // 3 years
            description: 'Number of days to keep appointment data before archiving and deletion.'
        }
    });

    await prisma.systemSetting.upsert({
        where: { key: 'retention_callbacks_days' },
        update: {},
        create: {
            key: 'retention_callbacks_days',
            value: '180', // ~6 months
            description: 'Number of days to keep callback requests (completed/no_answer) before archiving and deletion.'
        }
    });

    console.log('Retention settings seeded.');
}

seedRetentionSettings()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
