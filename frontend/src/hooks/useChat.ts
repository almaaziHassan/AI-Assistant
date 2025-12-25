import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface ConfirmationData {
  serviceName: string;
  staffName?: string;
  date: string;
  time: string;
  confirmationId: string;
  email: string;
}

export interface CallbackConfirmationData {
  name: string;
  phone: string;
  preferredTime: string;
  requestId: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  type?: 'text' | 'confirmation' | 'callback_confirmation';
  confirmation?: ConfirmationData;
  callbackConfirmation?: CallbackConfirmationData;
  action?: {
    type: string;
    data?: Record<string, unknown>;
  };
}

interface UseChatOptions {
  serverUrl: string;
}

const SESSION_STORAGE_KEY = 'ai-receptionist-session';

export function useChat({ serverUrl }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messageIdCounter = useRef(0);

  const generateId = () => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  };

  // Get stored session ID from localStorage
  const getStoredSessionId = (): string | null => {
    try {
      return localStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  };

  // Store session ID in localStorage
  const storeSessionId = (id: string): void => {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, id);
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);

      // Send init event with stored session ID
      const storedSessionId = getStoredSessionId();
      socket.emit('init', { sessionId: storedSessionId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      setError(`Connection error: ${err.message}`);
      setIsConnected(false);
    });

    // Handle session ID from server
    socket.on('session', (data: { sessionId: string }) => {
      setSessionId(data.sessionId);
      storeSessionId(data.sessionId);
    });

    // Handle chat history from server (with full message data including types and actions)
    socket.on('history', (data: {
      messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: string;
        messageType?: 'text' | 'confirmation' | 'callback_confirmation';
        actionType?: string;
        actionData?: {
          bookingConfirmation?: {
            id: string;
            serviceName: string;
            staffName?: string;
            date: string;
            time: string;
            customerName: string;
            customerEmail: string;
          };
          callbackConfirmation?: {
            id: string;
            customerName: string;
            customerPhone: string;
            preferredTime?: string;
          };
        };
      }>
    }) => {
      const historyMessages: Message[] = data.messages.map(msg => {
        // Restore confirmation card data
        if (msg.messageType === 'confirmation' && msg.actionData?.bookingConfirmation) {
          const conf = msg.actionData.bookingConfirmation;
          // Format date nicely
          const dateStr = new Date(conf.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          // Format time
          const [hours, minutes] = conf.time.split(':').map(Number);
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const timeStr = `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${ampm}`;

          return {
            id: generateId(),
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            type: 'confirmation' as const,
            confirmation: {
              serviceName: conf.serviceName,
              staffName: conf.staffName,
              date: dateStr,
              time: timeStr,
              confirmationId: conf.id.substring(0, 8).toUpperCase(),
              email: conf.customerEmail
            },
            action: { type: msg.actionType || 'booking_confirmed' }
          };
        }

        // Restore callback confirmation card data
        if (msg.messageType === 'callback_confirmation' && msg.actionData?.callbackConfirmation) {
          const conf = msg.actionData.callbackConfirmation;
          const preferredTimeLabels: Record<string, string> = {
            'morning': 'Morning (9am-12pm)',
            'afternoon': 'Afternoon (12pm-5pm)',
            'evening': 'Evening (5pm-8pm)',
            'anytime': 'Anytime'
          };

          return {
            id: generateId(),
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            type: 'callback_confirmation' as const,
            callbackConfirmation: {
              name: conf.customerName,
              phone: conf.customerPhone,
              preferredTime: conf.preferredTime ? preferredTimeLabels[conf.preferredTime] || conf.preferredTime : 'Anytime',
              requestId: conf.id.substring(0, 8).toUpperCase()
            },
            action: { type: msg.actionType || 'callback_confirmed' }
          };
        }

        // Regular text message with action type preserved
        return {
          id: generateId(),
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          type: 'text' as const,
          action: msg.actionType ? { type: msg.actionType } : undefined
        };
      });
      setMessages(historyMessages);
    });

    socket.on('message', (data: {
      role: 'assistant';
      content: string;
      timestamp: string;
      action?: Message['action'] & {
        bookingConfirmation?: {
          id: string;
          serviceName: string;
          staffName?: string;
          date: string;
          time: string;
          customerName: string;
          customerEmail: string;
        };
        callbackConfirmation?: {
          id: string;
          customerName: string;
          customerPhone: string;
          preferredTime?: string;
        };
      }
    }) => {
      // Check if this is a booking confirmation from AI
      if (data.action?.type === 'booking_confirmed' && data.action.bookingConfirmation) {
        const conf = data.action.bookingConfirmation;
        // Format date
        const dateStr = new Date(conf.date + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        // Format time
        const [hours, minutes] = conf.time.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const timeStr = `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${ampm}`;

        const newMessage: Message = {
          id: generateId(),
          role: data.role,
          content: data.content,
          timestamp: data.timestamp,
          type: 'confirmation',
          confirmation: {
            serviceName: conf.serviceName,
            staffName: conf.staffName,
            date: dateStr,
            time: timeStr,
            confirmationId: conf.id.substring(0, 8).toUpperCase(),
            email: conf.customerEmail
          },
          action: data.action
        };
        setMessages(prev => [...prev, newMessage]);
        return;
      }

      // Check if this is a callback confirmation from AI
      if (data.action?.type === 'callback_confirmed' && data.action.callbackConfirmation) {
        const conf = data.action.callbackConfirmation;
        const preferredTimeLabels: Record<string, string> = {
          'morning': 'Morning (9am-12pm)',
          'afternoon': 'Afternoon (12pm-5pm)',
          'evening': 'Evening (5pm-8pm)',
          'anytime': 'Anytime'
        };

        const newMessage: Message = {
          id: generateId(),
          role: data.role,
          content: data.content,
          timestamp: data.timestamp,
          type: 'callback_confirmation',
          callbackConfirmation: {
            name: conf.customerName,
            phone: conf.customerPhone,
            preferredTime: conf.preferredTime ? preferredTimeLabels[conf.preferredTime] || conf.preferredTime : 'Anytime',
            requestId: conf.id.substring(0, 8).toUpperCase()
          },
          action: data.action
        };
        setMessages(prev => [...prev, newMessage]);
        return;
      }

      // Regular message
      const newMessage: Message = {
        id: generateId(),
        role: data.role,
        content: data.content,
        timestamp: data.timestamp,
        action: data.action
      };
      setMessages(prev => [...prev, newMessage]);
    });

    socket.on('typing', (data: { isTyping: boolean }) => {
      setIsTyping(data.isTyping);
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl]);

  const sendMessage = useCallback((content: string) => {
    if (!socketRef.current || !isConnected) {
      setError('Not connected to server');
      return;
    }

    // Add user message to local state
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    // Send to server
    socketRef.current.emit('message', { content });
  }, [isConnected]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Start a new conversation (clears history and creates new session)
  const startNewConversation = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setMessages([]);
    setSessionId(null);

    // Reconnect with new session
    if (socketRef.current) {
      socketRef.current.emit('init', { sessionId: null });
    }
  }, []);

  // Add a message locally without sending to the AI
  const addLocalMessage = useCallback((
    content: string,
    role: 'user' | 'assistant' = 'assistant',
    options?: {
      type?: 'text' | 'confirmation' | 'callback_confirmation';
      confirmation?: ConfirmationData;
      callbackConfirmation?: CallbackConfirmationData;
    }
  ) => {
    const message: Message = {
      id: generateId(),
      role,
      content,
      timestamp: new Date().toISOString(),
      type: options?.type || 'text',
      confirmation: options?.confirmation,
      callbackConfirmation: options?.callbackConfirmation
    };
    setMessages(prev => [...prev, message]);
  }, []);

  // Save a confirmation message to the server (for persistence on refresh)
  const saveConfirmationToServer = useCallback((
    content: string,
    messageType: 'confirmation' | 'callback_confirmation',
    actionType: string,
    actionData: Record<string, unknown>
  ) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('saveConfirmation', {
        content,
        messageType,
        actionType,
        actionData
      });
    }
  }, [isConnected]);

  return {
    messages,
    isConnected,
    isTyping,
    error,
    sessionId,
    sendMessage,
    clearMessages,
    startNewConversation,
    addLocalMessage,
    saveConfirmationToServer
  };
}
