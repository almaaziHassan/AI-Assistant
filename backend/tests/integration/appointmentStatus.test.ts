import request from 'supertest';
import { createTestApp } from '../testApp';

const app = createTestApp();

describe('Appointment Status API', () => {
  // Helper to create a test appointment
  const createTestAppointment = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    const dateStr = tomorrow.toISOString().split('T')[0];

    // Get available slots
    const slotsResponse = await request(app)
      .get(`/api/appointments/slots?date=${dateStr}&serviceId=consultation`);

    const availableSlots = slotsResponse.body.slots?.filter((s: { available: boolean }) => s.available) || [];

    if (availableSlots.length === 0) {
      return null;
    }

    // Create appointment
    const response = await request(app)
      .post('/api/appointments')
      .send({
        customerName: 'Status Test User',
        customerEmail: `status-test-${Date.now()}@test.com`,
        customerPhone: '+14155551234',
        serviceId: 'consultation',
        date: dateStr,
        time: availableSlots[0].time
      });

    return response.body;
  };

  describe('POST /api/appointments - Initial Status', () => {
    it('should create appointment with pending status', async () => {
      const appointment = await createTestAppointment();

      if (appointment) {
        expect(appointment.status).toBe('pending');
      }
    });
  });

  describe('PATCH /api/appointments/:id/status', () => {
    it('should return 400 for invalid status', async () => {
      const appointment = await createTestAppointment();

      if (appointment) {
        const response = await request(app)
          .patch(`/api/appointments/${appointment.id}/status`)
          .send({ status: 'invalid-status' })
          .expect(400);

        expect(response.body.error).toContain('Status must be one of');
      }
    });

    it('should return 400 when status is missing', async () => {
      const appointment = await createTestAppointment();

      if (appointment) {
        const response = await request(app)
          .patch(`/api/appointments/${appointment.id}/status`)
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should return 400 for non-existent appointment', async () => {
      const response = await request(app)
        .patch('/api/appointments/non-existent-id/status')
        .send({ status: 'confirmed' })
        .expect(400);

      expect(response.body.error).toBe('Appointment not found');
    });

    describe('Status Transitions from Pending', () => {
      it('should NOT allow transition from pending to confirmed for future appointments', async () => {
        const appointment = await createTestAppointment();

        if (appointment) {
          const response = await request(app)
            .patch(`/api/appointments/${appointment.id}/status`)
            .send({ status: 'confirmed' })
            .expect(400);

          // Future appointments cannot be confirmed
          expect(response.body.error).toContain('Cannot mark future appointments');
        }
      });

      it('should allow transition from pending to cancelled', async () => {
        const appointment = await createTestAppointment();

        if (appointment) {
          const response = await request(app)
            .patch(`/api/appointments/${appointment.id}/status`)
            .send({ status: 'cancelled' })
            .expect(200);

          // Returns updated appointment object
          expect(response.body.status).toBe('cancelled');
          expect(response.body.id).toBe(appointment.id);
        }
      });

      it('should NOT allow transition from pending to completed', async () => {
        const appointment = await createTestAppointment();

        if (appointment) {
          const response = await request(app)
            .patch(`/api/appointments/${appointment.id}/status`)
            .send({ status: 'completed' })
            .expect(400);

          expect(response.body.error).toContain('Cannot change status from pending to completed');
        }
      });

      it('should NOT allow transition from pending to no-show for future appointments', async () => {
        const appointment = await createTestAppointment();

        if (appointment) {
          // Future appointments cannot be marked as no-show
          const response = await request(app)
            .patch(`/api/appointments/${appointment.id}/status`)
            .send({ status: 'no-show' })
            .expect(400);

          expect(response.body.error).toContain('Cannot mark future');
        }
      });
    });

    describe('Status Transitions from Confirmed', () => {
      it('should allow transition from confirmed to cancelled', async () => {
        const appointment = await createTestAppointment();

        if (appointment) {
          // First confirm the appointment
          await request(app)
            .patch(`/api/appointments/${appointment.id}/status`)
            .send({ status: 'confirmed' })
            .expect(200);

          // Then cancel it
          const response = await request(app)
            .patch(`/api/appointments/${appointment.id}/status`)
            .send({ status: 'cancelled' })
            .expect(200);

          // Returns updated appointment object
          expect(response.body.status).toBe('cancelled');
        }
      });

      it('should NOT allow completed/no-show for future appointments', async () => {
        const appointment = await createTestAppointment();

        if (appointment) {
          // First confirm the appointment
          await request(app)
            .patch(`/api/appointments/${appointment.id}/status`)
            .send({ status: 'confirmed' })
            .expect(200);

          // Try to mark as completed (should fail for future appointment)
          const response = await request(app)
            .patch(`/api/appointments/${appointment.id}/status`)
            .send({ status: 'completed' })
            .expect(400);

          expect(response.body.error).toContain('Cannot mark future or ongoing appointments');
        }
      });
    });

    describe('Final Status States', () => {
      it('should NOT allow changes from cancelled status', async () => {
        const appointment = await createTestAppointment();

        if (appointment) {
          // Cancel the appointment
          await request(app)
            .patch(`/api/appointments/${appointment.id}/status`)
            .send({ status: 'cancelled' })
            .expect(200);

          // Try to change from cancelled to confirmed
          const response = await request(app)
            .patch(`/api/appointments/${appointment.id}/status`)
            .send({ status: 'confirmed' })
            .expect(400);

          expect(response.body.error).toContain('Cannot change status from cancelled');
        }
      });
    });
  });

  describe('GET /api/appointments/stats', () => {
    it('should include pending count in stats', async () => {
      const response = await request(app)
        .get('/api/appointments/stats')
        .expect(200);

      expect(response.body).toHaveProperty('pending');
      expect(typeof response.body.pending).toBe('number');
      expect(response.body.pending).toBeGreaterThanOrEqual(0);
    });

    it('should return all required stat fields', async () => {
      const response = await request(app)
        .get('/api/appointments/stats')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('pending');
      expect(response.body).toHaveProperty('confirmed');
      expect(response.body).toHaveProperty('completed');
      expect(response.body).toHaveProperty('cancelled');
      expect(response.body).toHaveProperty('noShow');
      expect(response.body).toHaveProperty('noShowRate');
    });
  });

  describe('Valid Status Values', () => {
    it('should accept pending as valid status', async () => {
      const response = await request(app)
        .patch('/api/appointments/test-id/status')
        .send({ status: 'pending' });

      // Will fail because appointment doesn't exist, but status is valid
      expect(response.body.error).not.toContain('Status must be one of');
    });

    it('should accept confirmed as valid status', async () => {
      const response = await request(app)
        .patch('/api/appointments/test-id/status')
        .send({ status: 'confirmed' });

      expect(response.body.error).not.toContain('Status must be one of');
    });

    it('should accept cancelled as valid status', async () => {
      const response = await request(app)
        .patch('/api/appointments/test-id/status')
        .send({ status: 'cancelled' });

      expect(response.body.error).not.toContain('Status must be one of');
    });

    it('should accept completed as valid status', async () => {
      const response = await request(app)
        .patch('/api/appointments/test-id/status')
        .send({ status: 'completed' });

      expect(response.body.error).not.toContain('Status must be one of');
    });

    it('should accept no-show as valid status', async () => {
      const response = await request(app)
        .patch('/api/appointments/test-id/status')
        .send({ status: 'no-show' });

      expect(response.body.error).not.toContain('Status must be one of');
    });
  });
});
