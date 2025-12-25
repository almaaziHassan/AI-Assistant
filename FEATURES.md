# AI Virtual Receptionist - Features

A full-featured AI-powered virtual receptionist chatbot for service-based businesses.

---

## 🤖 AI-Powered Conversations

| Feature | Description |
|---------|-------------|
| **Context Awareness** | Remembers entire conversation history and references previous messages |
| **Intent Detection** | AI understands user intent (book, callback, escalate, info) without keyword matching |
| **Short Responses** | Maximum 2-3 sentences with bullet points, no walls of text |
| **FAQ Matching** | Automatically finds relevant FAQs based on user questions |
| **Industry Knowledge** | Recommends services based on user problems (e.g., back pain → Deep Tissue Massage) |
| **Multi-model Fallback** | Llama 3.3 70B → Llama 3.1 8B → Mixtral (automatic retry on failure) |
| **Function Calling** | Uses AI function calling for structured actions |

---

## 📅 Appointment Booking

| Feature | Description |
|---------|-------------|
| **Service Selection** | Browse all services with prices and durations |
| **Staff Selection** | Choose specific staff member or "Any available" |
| **Real-time Availability** | Shows only available time slots |
| **Date Validation** | Prevents past dates, max 30 days ahead booking |
| **Holiday Handling** | Respects closed days and custom holiday hours |
| **Conflict Detection** | Prevents double-booking same time slot |
| **Buffer Time** | Configurable gap between appointments (default 15 min) |
| **Email Confirmation** | Sends HTML confirmation email after booking |
| **Booking Lookup** | Find existing appointments by email |
| **Reschedule/Cancel** | Modify or cancel existing appointments |

---

## 📞 Callback Requests

| Feature | Description |
|---------|-------------|
| **Smart Detection** | AI asks for name and phone before creating callback |
| **Preferred Time** | Options: Morning, Afternoon, Evening, or Anytime |
| **Status Tracking** | Pending → Contacted → Completed/No Answer |
| **Concerns Capture** | Notes about what customer needs help with |
| **Validation** | Rejects empty or placeholder values |

---

## 🙋 Escalation to Human

| Feature | Description |
|---------|-------------|
| **AI Detection** | Understands phrases like "speak to real person", "manager", "human" |
| **Phone Display** | Shows business phone number for immediate contact |
| **Reason Tracking** | Logs why customer wanted escalation |

---

## 💬 Chat Interface

| Feature | Description |
|---------|-------------|
| **Real-time WebSocket** | Instant message delivery via Socket.IO |
| **Session Persistence** | Chat history saved to database, survives page refresh |
| **Typing Indicator** | Shows when AI is generating response |
| **New Conversation** | Button to start fresh chat anytime |
| **Confirmation Cards** | Beautiful styled cards for booking/callback confirmations |
| **Quick Action Buttons** | "Book Appointment" and "Request Callback" buttons |
| **User-Controlled Forms** | Forms only open when user clicks button (not auto-open) |
| **Embeddable Widget** | Add to any website via single script tag |

---

## 👨‍💼 Admin Dashboard

| Feature | Description |
|---------|-------------|
| **Overview Stats** | Today/week/month appointments, revenue, cancellations |
| **Appointment Management** | View, filter, and cancel appointments |
| **Staff Management** | Add/edit/delete staff members, assign services |
| **Location Management** | Support for multiple business locations |
| **Holiday Management** | Set closed days and custom operating hours |
| **Callback Tracking** | View and manage callback requests with status updates |
| **Waitlist Management** | Track customers waiting for specific services |

---

## 🏢 Business Configuration

| Feature | Description |
|---------|-------------|
| **Business Info** | Name, phone, email, address, website |
| **Operating Hours** | Per-day open/close times (Monday-Sunday) |
| **Services** | Name, description, duration, price for each service |
| **Receptionist Persona** | Customizable name, greeting, and personality |
| **FAQ Database** | Common questions with keyword matching |
| **Appointment Settings** | Slot duration, buffer time, max advance booking days |

---

## ✅ Validation & Security

| Feature | Description |
|---------|-------------|
| **Phone Validation** | Supports 40+ country formats with length validation |
| **Email Validation** | Format checking with common typo detection |
| **Input Sanitization** | Trims whitespace, prevents injection attacks |
| **CORS Configuration** | Controlled cross-origin access |
| **Rate Limiting** | API retry with exponential backoff |
| **Duplicate Prevention** | Prevents same booking twice |

---

## 📧 Email Service

| Feature | Description |
|---------|-------------|
| **SMTP Integration** | Nodemailer with configurable SMTP provider |
| **HTML Templates** | Beautiful confirmation emails with appointment details |
| **Fallback Logging** | Console output when SMTP not configured |

---

## 🗄️ Database

| Feature | Description |
|---------|-------------|
| **SQLite Storage** | Lightweight, file-based database (sql.js) |
| **Tables** | appointments, conversations, callbacks, staff, locations, holidays, waitlist |
| **Persistence** | Data saved to `data/receptionist.db` |
| **Indexes** | Optimized queries on frequently accessed fields |
| **Migration Support** | Schema updates handled automatically |

---

## 🔌 API Endpoints

### Chat
- `POST /api/chat` - Send message and get AI response
- `GET /api/chat/greeting` - Get initial greeting message

### Appointments
- `GET /api/appointments/slots` - Get available time slots
- `POST /api/appointments` - Book new appointment
- `GET /api/appointments/:id` - Get appointment details
- `DELETE /api/appointments/:id` - Cancel appointment
- `POST /api/appointments/:id/reschedule` - Reschedule appointment
- `GET /api/appointments/by-email/:email` - Get appointments by email

### Services
- `GET /api/services` - List all services
- `GET /api/services/:id` - Get service details
- `GET /api/services/business/info` - Get business information
- `GET /api/services/business/hours` - Get business hours

### Callbacks
- `POST /api/callbacks` - Create callback request
- `GET /api/callbacks` - Get all callbacks (admin)
- `PUT /api/callbacks/:id` - Update callback status
- `DELETE /api/callbacks/:id` - Delete callback

### Admin
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/appointments` - Get all appointments with filters
- `GET/POST/PUT/DELETE /api/admin/staff` - Staff CRUD
- `GET/POST/PUT/DELETE /api/admin/locations` - Location CRUD
- `GET/POST/PUT/DELETE /api/admin/holidays` - Holiday CRUD
- `GET/POST/DELETE /api/admin/waitlist` - Waitlist management

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js, Express, TypeScript, Socket.IO |
| **Frontend** | React 18, Vite, TypeScript |
| **AI** | Groq SDK (Llama 3.3 70B with fallbacks) |
| **Database** | SQLite (sql.js - in-memory with file persistence) |
| **Email** | Nodemailer (SMTP) |
| **Real-time** | WebSocket via Socket.IO |
| **Validation** | Custom phone (40+ countries) and email validation |

---

## 🚀 Quick Start

```bash
# Backend
cd backend
npm install
cp .env.example .env  # Add your GROQ_API_KEY
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **Admin Dashboard:** http://localhost:5173/#/admin

---

## 📊 Feature Count

| Category | Count |
|----------|-------|
| AI Features | 7 |
| Booking Features | 10 |
| Callback Features | 5 |
| Chat Features | 8 |
| Admin Features | 7 |
| Validation Features | 6 |
| API Endpoints | 20+ |
| **Total** | **50+ Features** |
