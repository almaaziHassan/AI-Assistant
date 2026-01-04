# 📡 API Reference

Base URL: `http://localhost:3000/api`

## 💬 Chat Endpoints

### 1. Send Message
Sends a user message to the AI receptionist.

- **Endpoint**: `POST /chat`
- **Auth**: None (Rate limited)
- **Body**:
  ```json
  {
    "message": "I need to book an appointment for tomorrow.",
    "sessionId": "uuid-v4-string"
  }
  ```
- **Response**:
  ```json
  {
    "response": "Certainly! I have availability at 2:00 PM. Does that work?",
    "audio": "base64_string_if_enabled"
  }
  ```

### 2. Get Greeting
Fetches the initial welcome message based on the configured persona.

- **Endpoint**: `GET /chat/greeting`
- **Response**:
  ```json
  {
    "message": "Hello! Welcome to Dr. Smith's Dental. How can I help you today?"
  }
  ```

---

## 📅 Appointment Endpoints

### 1. Get Available Slots
Finds free time slots for a specific date and service.

- **Endpoint**: `GET /appointments/slots`
- **Query Params**:
  - `date`: `YYYY-MM-DD` (Required)
  - `serviceId`: `string` (Required)
- **Response**:
  ```json
  {
    "slots": ["09:00", "09:30", "14:00", "14:30"]
  }
  ```

### 2. Create Appointment
Books a new appointment.

- **Endpoint**: `POST /appointments`
- **Body**:
  ```json
  {
    "serviceId": "cleaning",
    "date": "2023-12-25",
    "time": "09:00",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerPhone": "555-0123"
  }
  ```
- **Response**:
  ```json
  {
    "id": 1,
    "status": "confirmed",
    "confirmationCode": "APT-1234"
  }
  ```

### 3. Cancel Appointment
Cancels an existing booking.

- **Endpoint**: `DELETE /appointments/:id`
- **Response**: `200 OK`

---

## 🏢 Service & Business Info

### 1. Get Services
reLists all available services, prices, and durations.

- **Endpoint**: `GET /services`
- **Response**:
  ```json
  [
    {
      "id": "cleaning",
      "name": "Teeth Cleaning",
      "duration": 30,
      "price": 100
    }
  ]
  ```

### 2. Get Business Info
Returns public business details.

- **Endpoint**: `GET /services/business/info`
- **Response**:
  ```json
  {
    "name": "My Business",
    "address": "123 Main St",
    "phone": "555-5555"
  }
  ```

---

## 🔐 Admin Endpoints

> ⚠️ **Note**: Admin protection is currently WIP (Token/Session based).

- `GET /admin/appointments` - List all bookings
- `PATCH /admin/appointments/:id/status` - Update status (confirm/cancel)
- `GET /admin/stats` - Get dashboard statistics
