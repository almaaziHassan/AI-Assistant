import { v4 as uuidv4 } from 'uuid';
import { runQuery, getAll, getOne } from '../db/database';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  messageType?: 'text' | 'confirmation' | 'callback_confirmation';
  actionType?: string;
  actionData?: Record<string, unknown>;
  createdAt: string;
}

export interface SaveMessageOptions {
  messageType?: 'text' | 'confirmation' | 'callback_confirmation';
  actionType?: string;
  actionData?: Record<string, unknown>;
}

export class ChatHistoryService {
  // Save a message to the database
  saveMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    options?: SaveMessageOptions
  ): ChatMessage {
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const messageType = options?.messageType || 'text';
    const actionType = options?.actionType || null;
    const actionData = options?.actionData ? JSON.stringify(options.actionData) : null;

    runQuery(
      `INSERT INTO conversations (id, session_id, role, content, message_type, action_type, action_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sessionId, role, content, messageType, actionType, actionData, createdAt]
    );

    return { id, sessionId, role, content, messageType, actionType: options?.actionType, actionData: options?.actionData, createdAt };
  }

  // Load conversation history for a session (full data including types and actions)
  getHistory(sessionId: string, limit: number = 50): ChatMessage[] {
    const rows = getAll(
      `SELECT id, session_id as sessionId, role, content, message_type, action_type, action_data, created_at as createdAt
       FROM conversations
       WHERE session_id = ?
       ORDER BY created_at ASC
       LIMIT ?`,
      [sessionId, limit]
    );

    return rows.map(row => {
      let actionData: Record<string, unknown> | undefined;
      if (row.action_data) {
        try {
          actionData = JSON.parse(row.action_data as string);
        } catch {
          actionData = undefined;
        }
      }

      return {
        id: row.id as string,
        sessionId: row.sessionId as string,
        role: row.role as 'user' | 'assistant',
        content: row.content as string,
        messageType: (row.message_type as 'text' | 'confirmation' | 'callback_confirmation') || 'text',
        actionType: row.action_type as string | undefined,
        actionData,
        createdAt: row.createdAt as string
      };
    });
  }

  // Get the last N messages for context (simple format for AI)
  getRecentHistory(sessionId: string, limit: number = 20): { role: 'user' | 'assistant'; content: string }[] {
    const messages = this.getHistory(sessionId, limit);
    return messages.map(m => ({ role: m.role, content: m.content }));
  }

  // Get full history with all message data (for frontend restoration)
  getFullHistory(sessionId: string, limit: number = 50): ChatMessage[] {
    return this.getHistory(sessionId, limit);
  }

  // Check if a session exists
  sessionExists(sessionId: string): boolean {
    const row = getOne(
      `SELECT COUNT(*) as count FROM conversations WHERE session_id = ?`,
      [sessionId]
    );
    return row ? (row.count as number) > 0 : false;
  }

  // Create a new session ID
  createSession(): string {
    return uuidv4();
  }

  // Delete old sessions (cleanup)
  cleanupOldSessions(daysOld: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Get sessions to delete
    const oldSessions = getAll(
      `SELECT DISTINCT session_id FROM conversations
       WHERE created_at < ?`,
      [cutoffDate.toISOString()]
    );

    if (oldSessions.length === 0) return 0;

    const sessionIds = oldSessions.map(s => s.session_id as string);

    runQuery(
      `DELETE FROM conversations WHERE session_id IN (${sessionIds.map(() => '?').join(',')})`,
      sessionIds
    );

    return sessionIds.length;
  }

  // Get session summary (for admin/debugging)
  getSessionSummary(sessionId: string): { messageCount: number; firstMessage: string | null; lastMessage: string | null } | null {
    const messages = this.getHistory(sessionId);

    if (messages.length === 0) return null;

    return {
      messageCount: messages.length,
      firstMessage: messages[0].createdAt,
      lastMessage: messages[messages.length - 1].createdAt
    };
  }
}

export const chatHistoryService = new ChatHistoryService();
