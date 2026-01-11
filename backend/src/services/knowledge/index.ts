import { PrismaClient, KnowledgeDoc } from '@prisma/client';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

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

    // Embedding Model Pipeline
    private extractor: FeatureExtractionPipeline | null = null;
    private readonly MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

    private constructor() {
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

        console.log('Initializing Knowledge Service (Vector RAG)...');
        try {
            // 1. Load Model
            if (!this.extractor) {
                console.log('Loading embedding model...');
                this.extractor = await pipeline('feature-extraction', this.MODEL_NAME);
            }

            // 2. Load Docs from DB
            await this.loadDocs();

            this.isInitialized = true;
            console.log(`Knowledge Base initialized with ${this.cachedDocs.length} documents.`);
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
     * Vector Search
     */
    public async search(query: string, limit = 3): Promise<Array<{ id: string; title: string; content: string; score: number }>> {
        if (!this.isInitialized || !this.extractor) {
            await this.initialize();
        }

        try {
            const queryEmbedding = await this.generateEmbedding(query);

            // Calculate scores for all docs
            const scoredDocs = this.cachedDocs
                .filter(doc => doc.embedding !== null) // Skip docs without embeddings
                .map(doc => ({
                    id: doc.id,
                    title: doc.title,
                    content: doc.content,
                    score: this.cosineSimilarity(queryEmbedding, doc.embedding!)
                }));

            // Sort by score descending
            scoredDocs.sort((a, b) => b.score - a.score);

            // Filter out low relevance (e.g., < 0.3)
            const relevantDocs = scoredDocs.filter(d => d.score > 0.25);

            return relevantDocs.slice(0, limit);
        } catch (error) {
            console.error('Vector search failed:', error);
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
