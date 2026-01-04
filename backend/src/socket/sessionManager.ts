/**
 * Socket.IO Session Management
 * Handles session creation, persistence, and mapping between sockets and sessions
 */

import { chatHistoryService } from '../services/chatHistory';

// Conversation history structure
interface ConversationHistory {
    role: 'user' | 'assistant';
    content: string;
}

// Map socket IDs to session IDs
export const socketSessions = new Map<string, string>();

// In-memory conversation storage (for current session)
export const conversations = new Map<string, ConversationHistory[]>();

/**
 * Initialize or resume a session
 * Returns session information including whether it's a new session
 */
export function initializeSession(sessionId?: string): {
    sessionId: string;
    isNewSession: boolean;
    history: ConversationHistory[];
    fullHistory: any[];
} {
    let finalSessionId = sessionId;
    let isNewSession = false;

    // Create new session if none provided or invalid
    if (!finalSessionId || !chatHistoryService.sessionExists(finalSessionId)) {
        finalSessionId = chatHistoryService.createSession();
        isNewSession = true;
    }

    // Load existing history from database (simple format for AI context)
    const savedHistory = chatHistoryService.getRecentHistory(finalSessionId);

    // Load full history (with message types and action data) for frontend
    const fullHistory = chatHistoryService.getFullHistory(finalSessionId);

    return {
        sessionId: finalSessionId,
        isNewSession,
        history: savedHistory,
        fullHistory
    };
}

/**
 * Map a socket to a session
 */
export function mapSocketToSession(socketId: string, sessionId: string): void {
    socketSessions.set(socketId, sessionId);
}

/**
 * Get the session ID for a socket
 */
export function getSessionForSocket(socketId: string): string | undefined {
    return socketSessions.get(socketId);
}

/**
 * Save conversation history in memory
 */
export function saveConversationHistory(sessionId: string, history: ConversationHistory[]): void {
    conversations.set(sessionId, history);
}

/**
 * Get conversation history from memory
 */
export function getConversationHistory(sessionId: string): ConversationHistory[] {
    return conversations.get(sessionId) || [];
}

/**
 * Cleanup socket session mapping
 */
export function cleanupSocket(socketId: string): void {
    socketSessions.delete(socketId);
    // Note: We don't delete conversation history from memory or DB
    // This allows session resumption
}
