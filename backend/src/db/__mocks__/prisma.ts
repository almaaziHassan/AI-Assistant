import { PrismaClient } from '@prisma/client';

// Simple in-memory store
const store: Record<string, any[]> = {
    appointment: [],
    callback: [],
    systemSetting: [],
    user: [],
    staff: [],
    service: [],
    location: [],
    holiday: [],
    conversation: [],
    knowledgeDoc: [],
    faq: [],
    contactProfile: [],
};

// Generic CRUD handler
const createDelegate = (model: string) => ({
    findMany: jest.fn(async (args) => {
        return store[model] || [];
    }),
    findUnique: jest.fn(async (args) => {
        const id = args?.where?.id || args?.where?.key;
        return store[model]?.find((item) => item.id === id || item.key === id) || null;
    }),
    findFirst: jest.fn(async (args) => {
        return store[model]?.[0] || null;
    }),
    create: jest.fn(async (args) => {
        const data = { ...args.data, id: args.data.id || String(Date.now()) };
        store[model] = store[model] || [];
        store[model].push(data);
        return data;
    }),
    update: jest.fn(async (args) => {
        const id = args?.where?.id || args?.where?.key;
        const index = store[model]?.findIndex((item) => item.id === id || item.key === id);
        if (index !== undefined && index !== -1) {
            store[model][index] = { ...store[model][index], ...args.data };
            return store[model][index];
        }
        throw new Error('Record not found');
    }),
    delete: jest.fn(async (args) => {
        const id = args?.where?.id;
        const index = store[model]?.findIndex((item) => item.id === id);
        if (index !== undefined && index !== -1) {
            const deleted = store[model][index];
            store[model].splice(index, 1);
            return deleted;
        }
        throw new Error('Record not found');
    }),
    deleteMany: jest.fn(async () => ({ count: 1 })),
    count: jest.fn(async () => store[model]?.length || 0),
    groupBy: jest.fn(async () => []),
    upsert: jest.fn(async (args) => {
        // Simple upsert logic
        const id = args?.where?.id || args?.where?.key;
        const existing = store[model]?.find((item) => item.id === id || item.key === id);
        if (existing) {
            const index = store[model]?.findIndex((item) => item.id === id || item.key === id);
            store[model][index] = { ...existing, ...args.update };
            return store[model][index];
        } else {
            const data = { ...args.create, id: args.create.id || id || String(Date.now()) };
            store[model] = store[model] || [];
            store[model].push(data);
            return data;
        }
    })
});

// Mock Prisma Client
const mockPrisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{
        today_count: 0,
        week_count: 0,
        month_count: 0,
        cancelled_count: 0,
        noshow_count: 0,
        upcoming_count: 0
    }]),
    appointment: createDelegate('appointment'),
    callback: createDelegate('callback'),
    systemSetting: createDelegate('systemSetting'),
    user: createDelegate('user'),
    staff: createDelegate('staff'),
    service: createDelegate('service'),
    location: createDelegate('location'),
    holiday: createDelegate('holiday'),
    conversation: createDelegate('conversation'),
    knowledgeDoc: createDelegate('knowledgeDoc'),
    faq: createDelegate('faq'),
    fAQ: createDelegate('fAQ'),
    contactProfile: createDelegate('contactProfile'),
};

export default mockPrisma;
