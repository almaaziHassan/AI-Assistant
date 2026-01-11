import { PrismaClient, KnowledgeDoc } from '@prisma/client';
// Dynamic import required for @xenova/transformers in CJS environment
import MiniSearch from 'minisearch';

const prisma = new PrismaClient();

// Interface for in-memory document with embedding
interface CachedDoc {
    id: string;
    title: string;
    content: string;
    tags: string[];
    embedding: number[] | null;
}

export class KnowledgeService {
    private static instance: KnowledgeService;
    private isInitialized = false;

    // In-memory store
    private cachedDocs: CachedDoc[] = [];
    private searchIndex: MiniSearch; // Keyword Search Index

    // Embedding Model Pipeline
    private extractor: any = null; // Type: FeatureExtractionPipeline (Dynamic import)
    private readonly MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

    private constructor() {
        // Initialize MiniSearch
        this.searchIndex = new MiniSearch({
            fields: ['title', 'content', 'tags'], // fields to index for full-text search
            storeFields: ['title', 'content', 'tags', 'id'], // fields to return with search results
            searchOptions: {
                boost: { title: 2, tags: 1.5 },
                fuzzy: 0.2, // typo tolerance
                prefix: true
            }
        });
        // Initialize pipeline lazily in initialize()
    }

    public static getInstance(): KnowledgeService {
        if (!KnowledgeService.instance) {
            KnowledgeService.instance = new KnowledgeService();
        }
        return KnowledgeService.instance;
    }

    /**
     * Initialize the Embedding Model and load docs
     */
    public async initialize() {
        if (this.isInitialized) return;

        console.log('Initializing Knowledge Service (Hybrid RAG)...');
        try {
            // 1. Load Model (Dynamic Import)
            if (!this.extractor) {
                console.log('Loading embedding model...');
                const { pipeline } = await import('@xenova/transformers');
                this.extractor = await pipeline('feature-extraction', this.MODEL_NAME);
            }

            // 2. Load Docs from DB
            const docs = await prisma.knowledgeDoc.findMany({
                where: { isActive: true }
            });
            this.cachedDocs = docs.map(doc => ({
                id: doc.id,
                title: doc.title,
                content: doc.content,
                tags: Array.isArray(doc.tags) ? (doc.tags as string[]) : [],
                embedding: (doc.embedding as unknown as number[]) || null
            }));

            // Re-build MiniSearch index
            this.searchIndex.removeAll();
            const records = this.cachedDocs.map(doc => ({
                id: doc.id,
                title: doc.title,
                content: doc.content,
                tags: doc.tags.join(' ')
            }));
            this.searchIndex.addAll(records);

            this.isInitialized = true;
            console.log(`Knowledge Base initialized with ${docs.length} documents.`);
        } catch (error) {
            console.error('Failed to initialize Knowledge Service:', error);
        }
    }

    private async loadDocs() {
        const docs = await prisma.knowledgeDoc.findMany({
            where: { isActive: true }
        });

        this.cachedDocs = docs.map(doc => ({
            id: doc.id,
            title: doc.title,
            content: doc.content,
            tags: Array.isArray(doc.tags) ? (doc.tags as string[]) : [],
            embedding: (doc.embedding as unknown as number[]) || null
        }));

        // Re-build MiniSearch index
        this.searchIndex.removeAll();
        const records = this.cachedDocs.map(doc => ({
            id: doc.id,
            title: doc.title,
            content: doc.content,
            tags: doc.tags.join(' ')
        }));
        this.searchIndex.addAll(records);
    }

    public async refreshIndex() {
        await this.loadDocs();
    }

    /**
     * Generate embedding for a text string
     */
    private async generateEmbedding(text: string): Promise<number[]> {
        if (!this.extractor) {
            await this.initialize();
        }
        if (!this.extractor) throw new Error('Model failed to load');

        // Feature extraction returns a Tensor
        const output = await this.extractor(text, { pooling: 'mean', normalize: true });
        // Convert Tensor to standard array
        return Array.from(output.data as Float32Array);
    }

    /**
     * Calculate Cosine Similarity between two vectors
     */
    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * HYBRID SEARCH (Keyword + Vector) with Reciprocal Rank Fusion (RRF)
     */
    public async search(query: string, limit = 3): Promise<Array<{ id: string; title: string; content: string; score: number }>> {
        if (!this.isInitialized || !this.extractor) {
            await this.initialize();
        }

        try {
            // 1. Vector Search
            const queryEmbedding = await this.generateEmbedding(query);
            const vectorResults = this.cachedDocs
                .filter(doc => doc.embedding !== null)
                .map(doc => ({
                    id: doc.id,
                    score: this.cosineSimilarity(queryEmbedding, doc.embedding!)
                }))
                .filter(r => r.score > 0.15)
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);

            // 2. Keyword Search
            const keywordResults = this.searchIndex.search(query)
                .map(res => ({ id: res.id, score: res.score }))
                .slice(0, 10);

            // 3. RRF Fusion
            const rrfScores = new Map<string, number>();
            const k = 60; // RRF constant

            vectorResults.forEach((res, rank) => {
                const current = rrfScores.get(res.id) || 0;
                rrfScores.set(res.id, current + (1 / (k + rank + 1)));
            });

            keywordResults.forEach((res, rank) => {
                const current = rrfScores.get(res.id) || 0;
                rrfScores.set(res.id, current + (1 / (k + rank + 1)));
            });

            // 4. Sort & Format
            const finalResults = Array.from(rrfScores.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit)
                .map(([id, score]) => {
                    const doc = this.cachedDocs.find(d => d.id === id);
                    if (!doc) return null;
                    return {
                        id: doc.id,
                        title: doc.title,
                        content: doc.content,
                        score: score
                    };
                })
                .filter((r): r is NonNullable<typeof r> => r !== null);

            return finalResults;

        } catch (error) {
            console.error('Hybrid search failed:', error);
            return [];
        }
    }

    // --- CRUD Operations ---

    public async createDoc(data: { title: string; content: string; tags: string[] }) {
        // Generate embedding before saving
        const textToEmbed = `${data.title}\n\n${data.content}`;
        const embedding = await this.generateEmbedding(textToEmbed);

        const doc = await prisma.knowledgeDoc.create({
            data: {
                title: data.title,
                content: data.content,
                tags: data.tags,
                embedding: embedding as any // Save array as JSON equivalent
            }
        });
        await this.refreshIndex();
        return doc;
    }

    public async updateDoc(id: string, data: { title?: string; content?: string; tags?: string[]; isActive?: boolean }) {
        let embedding: number[] | undefined;

        // Re-generate embedding if content changed
        if (data.title || data.content) {
            // Fetch current doc to merge content if needed (simple approach: just embed what's passed or fetch fresh)
            const existing = await prisma.knowledgeDoc.findUnique({ where: { id } });
            if (existing) {
                const newTitle = data.title ?? existing.title;
                const newContent = data.content ?? existing.content;
                const textToEmbed = `${newTitle}\n\n${newContent}`;
                embedding = await this.generateEmbedding(textToEmbed);
            }
        }

        const doc = await prisma.knowledgeDoc.update({
            where: { id },
            data: {
                ...data,
                ...(embedding && { embedding: embedding as any })
            }
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
