import React, { useEffect, useRef } from 'react';
import { Message, ConfirmationData, CallbackConfirmationData } from '../hooks/useChat';

interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
}

const ConfirmationCard: React.FC<{ data: ConfirmationData }> = ({ data }) => (
  <div className="confirmation-card">
    <div className="confirmation-header">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <span>Appointment Confirmed!</span>
    </div>
    <div className="confirmation-details">
      <div className="confirmation-row">
        <span className="confirmation-label">Service</span>
        <span className="confirmation-value">{data.serviceName}</span>
      </div>
      {data.staffName && (
        <div className="confirmation-row">
          <span className="confirmation-label">With</span>
          <span className="confirmation-value">{data.staffName}</span>
        </div>
      )}
      <div className="confirmation-row">
        <span className="confirmation-label">Date</span>
        <span className="confirmation-value">{data.date}</span>
      </div>
      <div className="confirmation-row">
        <span className="confirmation-label">Time</span>
        <span className="confirmation-value">{data.time}</span>
      </div>
      <div className="confirmation-row">
        <span className="confirmation-label">Confirmation #</span>
        <span className="confirmation-value confirmation-id">{data.confirmationId}</span>
      </div>
    </div>
    <div className="confirmation-footer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
      <span>Confirmation sent to {data.email}</span>
    </div>
  </div>
);

const CallbackConfirmationCard: React.FC<{ data: CallbackConfirmationData }> = ({ data }) => (
  <div className="callback-success-card">
    <div className="callback-success-header">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
      <span>Callback Requested!</span>
    </div>
    <div className="callback-success-details">
      <div className="callback-success-row">
        <span className="callback-success-label">Name</span>
        <span className="callback-success-value">{data.name}</span>
      </div>
      <div className="callback-success-row">
        <span className="callback-success-label">Phone</span>
        <span className="callback-success-value">{data.phone}</span>
      </div>
      <div className="callback-success-row">
        <span className="callback-success-label">Best Time</span>
        <span className="callback-success-value">{data.preferredTime}</span>
      </div>
      <div className="callback-success-row">
        <span className="callback-success-label">Request #</span>
        <span className="callback-success-value">{data.requestId}</span>
      </div>
    </div>
    <div className="callback-success-footer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>Our team will call you soon!</span>
    </div>
  </div>
);

const MessageList: React.FC<MessageListProps> = ({ messages, isTyping }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="ai-receptionist-messages">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`ai-receptionist-message ${message.role}`}
        >
          {message.type === 'confirmation' && message.confirmation ? (
            <ConfirmationCard data={message.confirmation} />
          ) : message.type === 'callback_confirmation' && message.callbackConfirmation ? (
            <CallbackConfirmationCard data={message.callbackConfirmation} />
          ) : (
            <div className="message-content">
              {message.content}
            </div>
          )}
          <div className="message-time">
            {formatTime(message.timestamp)}
          </div>
        </div>
      ))}

      {isTyping && (
        <div className="ai-receptionist-message assistant">
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
