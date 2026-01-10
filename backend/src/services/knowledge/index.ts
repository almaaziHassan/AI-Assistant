import { PrismaClient, KnowledgeDoc } from '@prisma/client';
import MiniSearch from 'minisearch';

const prisma = new PrismaClient();

export class KnowledgeService {
    private static instance: KnowledgeService;
    private searchIndex: MiniSearch;
    private isInitialized = false;

    private constructor() {
        this.searchIndex = new MiniSearch({
            fields: ['title', 'content', 'tags'], // fields to index for full-text search
            storeFields: ['title', 'content', 'tags', 'id'], // fields to return with search results
            searchOptions: {
                boost: { title: 2, tags: 1.5 },
                fuzzy: 0.2,
                prefix: true
            }
        });
    }

    public static getInstance(): KnowledgeService {
        if (!KnowledgeService.instance) {
            KnowledgeService.instance = new KnowledgeService();
        }
        return KnowledgeService.instance;
    }

    /**
     * Load all active documents from DB into MiniSearch index
     */
    public async initialize() {
        if (this.isInitialized) return;

        try {
            const docs = await prisma.knowledgeDoc.findMany({
                where: { isActive: true }
            });

            // Format for MiniSearch (needs 'id' field)
            const records = docs.map(doc => ({
                id: doc.id,
                title: doc.title,
                content: doc.content,
                tags: Array.isArray(doc.tags) ? (doc.tags as string[]).join(' ') : ''
            }));

            this.searchIndex.removeAll();
            this.searchIndex.addAll(records);
            this.isInitialized = true;
            console.log(`Knowledge Base initialized with ${docs.length} documents.`);
        } catch (error) {
            console.error('Failed to initialize Knowledge Base:', error);
            // Fallback or retry logic could go here
        }
    }

    /**
     * Refresh the index (call after CRUD operations)
     */
    public async refreshIndex() {
        this.isInitialized = false;
        await this.initialize();
    }

    /**
     * Search for relevant documents
     */
    public search(query: string, limit = 3): Array<{ id: string; title: string; content: string; score: number }> {
        if (!this.isInitialized) {
            console.warn('Knowledge Base search called before initialization.');
            return [];
        }

        const results = this.searchIndex.search(query);

        // Return top N results with their content
        return results.slice(0, limit).map(res => ({
            id: res.id,
            title: res.title,
            content: res.content,
            score: res.score
        }));
    }

    // --- CRUD Operations (Passthrough to Prisma + Auto Refresh) ---

    public async createDoc(data: { title: string; content: string; tags: string[] }) {
        const doc = await prisma.knowledgeDoc.create({
            data: {
                title: data.title,
                content: data.content,
                tags: data.tags
            }
        });
        await this.refreshIndex();
        return doc;
    }

    public async updateDoc(id: string, data: { title?: string; content?: string; tags?: string[]; isActive?: boolean }) {
        const doc = await prisma.knowledgeDoc.update({
            where: { id },
            data
        });
        await this.refreshIndex();
        return doc;
    }

    public async deleteDoc(id: string) {
        const doc = await prisma.knowledgeDoc.delete({
            where: { id }
        });
        await this.refreshIndex();
        return doc;
    }

    public async getAllDocs(activeOnly = false) {
        return prisma.knowledgeDoc.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            orderBy: { updatedAt: 'desc' }
        });
    }

    public async getDocById(id: string) {
        return prisma.knowledgeDoc.findUnique({
            where: { id }
        });
    }
}
