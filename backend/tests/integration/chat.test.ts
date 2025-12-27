import request from 'supertest';
import { createTestApp } from '../testApp';

const app = createTestApp();

// Mock the Groq service to avoid external API calls
jest.mock('../../src/services/groq', () => ({
  GroqService: jest.fn().mockImplementation(() => ({
    chatWithFunctions: jest.fn().mockResolvedValue({
      message: 'Hello! Welcome to Serenity Wellness Spa. How can I help you today?',
      functionCall: null
    })
  }))
}));

describe('Chat API Integration', () => {
  describe('GET /api/chat/greeting', () => {
    it('should return initial greeting', async () => {
      const response = await request(app)
        .get('/api/chat/greeting')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('receptionistName');
      expect(response.body).toHaveProperty('businessName');
      expect(response.body.businessName).toBe('Serenity Wellness Spa');
    });

    it('should include receptionist name in greeting', async () => {
      const response = await request(app)
        .get('/api/chat/greeting')
        .expect(200);

      expect(response.body.receptionistName).toBeDefined();
      expect(typeof response.body.receptionistName).toBe('string');
    });
  });

  describe('POST /api/chat', () => {
    it('should reject empty message', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Message is required');
    });

    it('should reject non-string message', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({ message: 123 })
        .expect(400);

      expect(response.body.error).toContain('Message is required');
    });

    it('should process valid message', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'Hello' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.message).toBe('string');
    });

    it('should accept message with history', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'What services do you offer?',
          history: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Welcome!' }
          ]
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should return timestamp in ISO format', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'Test' })
        .expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('Chat Response Structure', () => {
    it('should optionally include action', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'Hi there' })
        .expect(200);

      // Action can be present or undefined
      if (response.body.action) {
        expect(response.body.action).toHaveProperty('type');
      }
    });
  });
});

describe('Chat Message Validation', () => {
  it('should handle very long messages', async () => {
    const longMessage = 'a'.repeat(5000);
    const response = await request(app)
      .post('/api/chat')
      .send({ message: longMessage })
      .expect(200);

    expect(response.body).toHaveProperty('message');
  });

  it('should handle unicode characters', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({ message: '你好！こんにちは！🌟' })
      .expect(200);

    expect(response.body).toHaveProperty('message');
  });

  it('should handle special characters', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({ message: 'Test <script>alert("xss")</script>' })
      .expect(200);

    expect(response.body).toHaveProperty('message');
  });
});
