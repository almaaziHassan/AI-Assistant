import prisma from '../src/db/prisma';
import { v4 as uuidv4 } from 'uuid';

async function main() {
    console.log('🌱 Seeding CRM Data...');

    // 1. VIP User (Sarah Connor)
    const vipEmail = 'sarah.connor@example.com';
    let vipUser = await prisma.user.findUnique({ where: { email: vipEmail } });

    if (!vipUser) {
        vipUser = await prisma.user.create({
            data: {
                email: vipEmail,
                name: 'Sarah Connor',
                phone: '555-0199',
                role: 'customer'
            }
        });
    }

    // Create Profile
    await prisma.contactProfile.upsert({
        where: { email: vipEmail },
        create: {
            email: vipEmail,
            userId: vipUser.id,
            phone: vipUser.phone,
            tags: ['vip', 'loyal', 'coffee-lover'],
            notes: 'Prefers morning appointments. Always books with Marcus.',
            lastSeenAt: new Date()
        },
        update: {}
    });

    // Create Appointments for VIP
    await prisma.appointment.createMany({
        data: [
            {
                id: uuidv4(),
                customerName: 'Sarah Connor',
                customerEmail: vipEmail,
                customerPhone: '555-0199',
                serviceId: 'cut-1',
                serviceName: 'Haircut',
                appointmentDate: new Date('2025-01-10'),
                appointmentTime: new Date('2025-01-10T10:00:00'),
                duration: 60,
                status: 'completed',
                userId: vipUser.id
            },
            {
                id: uuidv4(),
                customerName: 'Sarah Connor',
                customerEmail: vipEmail,
                customerPhone: '555-0199',
                serviceId: 'color-1',
                serviceName: 'Coloring',
                appointmentDate: new Date('2025-02-15'),
                appointmentTime: new Date('2025-02-15T10:00:00'),
                duration: 120,
                status: 'confirmed',
                userId: vipUser.id
            }
        ]
    });

    // 2. Ghost User (Kyle Reese)
    const ghostEmail = 'kyle@resistance.com';
    await prisma.appointment.createMany({
        data: [
            {
                id: uuidv4(),
                customerName: 'Kyle Reese',
                customerEmail: ghostEmail,
                customerPhone: '555-2029',
                serviceId: 'consult-1',
                serviceName: 'Consultation',
                appointmentDate: new Date('2024-12-01'),
                appointmentTime: new Date('2024-12-01T14:00:00'),
                duration: 30,
                status: 'no-show'
            },
            {
                id: uuidv4(),
                customerName: 'Kyle Reese',
                customerEmail: ghostEmail,
                customerPhone: '555-2029',
                serviceId: 'cut-1',
                serviceName: 'Haircut',
                appointmentDate: new Date('2024-12-20'),
                appointmentTime: new Date('2024-12-20T15:00:00'),
                duration: 60,
                status: 'no-show'
            }
        ]
    });

    // 3. Guest User (John Doe)
    const guestEmail = 'john.doe.guest@example.com';
    await prisma.appointment.create({
        data: {
            id: uuidv4(),
            customerName: 'John Doe',
            customerEmail: guestEmail,
            customerPhone: '555-0001',
            serviceId: 'cut-1',
            serviceName: 'Haircut',
            appointmentDate: new Date('2025-01-05'),
            appointmentTime: new Date('2025-01-05T09:00:00'),
            duration: 60,
            status: 'completed'
        }
    });

    console.log('✅ CRM Seed Complete');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
