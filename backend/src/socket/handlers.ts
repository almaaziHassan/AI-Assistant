/**
 * Socket.IO Event Handlers
 * Handles all socket events for real-time chat functionality
 */

import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ReceptionistService } from '../services/receptionist';
import { chatHistoryService } from '../services/chatHistory';
import {
    initializeSession,
    mapSocketToSession,
    getSessionForSocket,
    getConversationHistory,
    saveConversationHistory,
    cleanupSocket
} from './sessionManager';

// JWT payload type
interface JWTPayload {
    userId: string;
    email: string;
    role: string;
}

/**
 * Verify JWT token and extract user info
 */
function verifyAuthToken(token: string): JWTPayload | null {
    try {
        const secret = process.env.JWT_SECRET || 'default-secret';
        const payload = jwt.verify(token, secret) as JWTPayload;
        return payload;
    } catch {
        return null;
    }
}

/**
 * Create socket handlers with injectable dependencies
 */
export function createSocketHandlers(
    receptionist: ReceptionistService = new ReceptionistService()
) {
    /**
     * Handle socket connection
     */
    function handleConnection(socket: Socket): void {
        console.log(`Client connected: ${socket.id}`);

        // Initialize session handler
        socket.on('init', handleInit(socket));

        // Handle incoming messages
        socket.on('message', handleMessage(socket));

        // Handle confirmation saves
        socket.on('saveConfirmation', handleSaveConfirmation(socket));

        // Handle disconnect
        socket.on('disconnect', handleDisconnect(socket));
    }

    /**
     * Handle session initialization
     * If authToken is provided and valid, use user ID as session ID
     */
    function handleInit(socket: Socket) {
        return (data: { sessionId?: string; authToken?: string }) => {
            let effectiveSessionId: string | undefined = data.sessionId;
            let isUserSession = false;

            // Check for authenticated user
            if (data.authToken) {
                const user = verifyAuthToken(data.authToken);
                if (user) {
                    // Use "user-{userId}" as session ID for authenticated users
                    effectiveSessionId = `user-${user.userId}`;
                    isUserSession = true;
                    console.log(`Authenticated user chat session: ${user.email}`);
                }
            }

            const { sessionId, isNewSession, history, fullHistory } = initializeSession(effectiveSessionId);

            // Map socket to session
            mapSocketToSession(socket.id, sessionId);

            // Save history in memory
            saveConversationHistory(sessionId, history);

            // Send session ID to client (for guests, they store it; for users, it's permanent)
            socket.emit('session', { sessionId, isUserSession });

            // Send chat history to client with full message data
            if (fullHistory.length > 0) {
                socket.emit('history', {
                    messages: fullHistory.map(msg => ({
                        role: msg.role,
                        content: msg.content,
                        timestamp: msg.createdAt,
                        messageType: msg.messageType || 'text',
                        actionType: msg.actionType,
                        actionData: msg.actionData
                    }))
                });
            }

            // Send welcome message only for new sessions
            if (isNewSession) {
                const config = receptionist.getConfig();
                const greeting = config.receptionist.greeting
                    .replace('{business_name}', config.business.name)
                    .replace('{receptionist_name}', config.receptionist.name);

                // Save greeting to database
                chatHistoryService.saveMessage(sessionId, 'assistant', greeting);

                socket.emit('message', {
                    role: 'assistant',
                    content: greeting,
                    timestamp: new Date().toISOString()
                });
            }
        };
    }

    /**
     * Handle incoming messages from user
     */
    function handleMessage(socket: Socket) {
        return async (data: { content: string }) => {
            const sessionId = getSessionForSocket(socket.id);
            if (!sessionId) {
                console.error('No session found for socket:', socket.id);
                return;
            }

            const history = getConversationHistory(sessionId);

            // Add user message to history and save to database
            history.push({ role: 'user', content: data.content });
            chatHistoryService.saveMessage(sessionId, 'user', data.content);

            // Emit typing indicator
            socket.emit('typing', { isTyping: true });

            const config = receptionist.getConfig();

            try {
                // Get AI response
                const response = await receptionist.chat(data.content, history);

                // Add assistant response to history and save to database
                history.push({ role: 'assistant', content: response.message });
                saveConversationHistory(sessionId, history);

                // Determine message type and action data for storage
                let messageType: 'text' | 'confirmation' | 'callback_confirmation' = 'text';
                let actionData: Record<string, unknown> | undefined;

                if (response.action?.type === 'booking_confirmed' && response.action.bookingConfirmation) {
                    messageType = 'confirmation';
                    actionData = { bookingConfirmation: response.action.bookingConfirmation };
                } else if (response.action?.type === 'callback_confirmed' && response.action.callbackConfirmation) {
                    messageType = 'callback_confirmation';
                    actionData = { callbackConfirmation: response.action.callbackConfirmation };
                } else if (response.action?.data) {
                    actionData = response.action.data;
                }

                // Save message with full action data
                chatHistoryService.saveMessage(sessionId, 'assistant', response.message, {
                    messageType,
                    actionType: response.action?.type,
                    actionData
                });

                // Stop typing indicator
                socket.emit('typing', { isTyping: false });

                // Send response
                socket.emit('message', {
                    role: 'assistant',
                    content: response.message,
                    action: response.action,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error('Error processing message:', errorMessage);
                console.error('Full error:', error);
                socket.emit('typing', { isTyping: false });

                // Provide a more helpful error message
                const isAiError = errorMessage.includes('AI service') || errorMessage.includes('GROQ') || errorMessage.includes('API');
                const fallbackContent = isAiError
                    ? "I'm having a brief technical difficulty. Could you try your message again? If you'd like to book an appointment, I can help with that!"
                    : config.receptionist.fallbackMessage;

                socket.emit('message', {
                    role: 'assistant',
                    content: fallbackContent,
                    timestamp: new Date().toISOString()
                });
            }
        };
    }

    /**
     * Handle saving confirmation messages (from form-based bookings)
     */
    function handleSaveConfirmation(socket: Socket) {
        return (data: {
            content: string;
            messageType: 'confirmation' | 'callback_confirmation';
            actionType: string;
            actionData: Record<string, unknown>;
        }) => {
            const sessionId = getSessionForSocket(socket.id);
            if (!sessionId) {
                console.error('No session found for socket:', socket.id);
                return;
            }

            // Save the confirmation message to database
            chatHistoryService.saveMessage(sessionId, 'assistant', data.content, {
                messageType: data.messageType,
                actionType: data.actionType,
                actionData: data.actionData
            });

            // Add to in-memory history
            const history = getConversationHistory(sessionId);
            history.push({ role: 'assistant', content: data.content });
            saveConversationHistory(sessionId, history);
        };
    }

    /**
     * Handle socket disconnect
     */
    function handleDisconnect(socket: Socket) {
        return () => {
            console.log(`Client disconnected: ${socket.id}`);
            cleanupSocket(socket.id);
        };
    }

    return {
        handleConnection,
        handleInit,
        handleMessage,
        handleSaveConfirmation,
        handleDisconnect
    };
}

// Export default handlers for backwards compatibility
const defaultHandlers = createSocketHandlers();
export const handleConnection = defaultHandlers.handleConnection;
export const handleInit = defaultHandlers.handleInit;
export const handleMessage = defaultHandlers.handleMessage;
export const handleSaveConfirmation = defaultHandlers.handleSaveConfirmation;
export const handleDisconnect = defaultHandlers.handleDisconnect;
