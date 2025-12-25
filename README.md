# AI Virtual Receptionist

An AI-powered virtual receptionist chatbot that handles inquiries, schedules appointments, and provides information about your services. Built with Node.js, React, and Groq AI.

## Features

- Natural language conversations powered by Groq AI (Llama 3.1 70B)
- Real-time chat via WebSocket (Socket.IO)
- Appointment scheduling with availability checking
- Configurable business information, services, and hours
- Embeddable chat widget for any website
- Mobile-responsive design

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Groq API key (get one at https://console.groq.com)

### Installation

1. **Clone and install backend dependencies:**

```bash
cd backend
npm install
```

2. **Configure environment:**

```bash
cp ../.env.example .env
# Edit .env and add your GROQ_API_KEY
```

3. **Start the backend:**

```bash
npm run dev
```

4. **Install and start frontend (in a new terminal):**

```bash
cd frontend
npm install
npm run dev
```

5. **Open http://localhost:5173** to see the demo page with the chat widget.

## Configuration

Edit `backend/src/config/services.json` to customize:

### Business Information
```json
{
  "business": {
    "name": "Your Business Name",
    "description": "Description of your business",
    "phone": "+1 (555) 123-4567",
    "email": "contact@yourbusiness.com",
    "address": "123 Main Street, City, State"
  }
}
```

### Business Hours
```json
{
  "hours": {
    "monday": { "open": "09:00", "close": "17:00" },
    "sunday": { "open": null, "close": null }
  }
}
```

### Services
```json
{
  "services": [
    {
      "id": "consultation",
      "name": "Initial Consultation",
      "description": "A 30-minute introductory session",
      "duration": 30,
      "price": 50
    }
  ]
}
```

### Receptionist Persona
```json
{
  "receptionist": {
    "name": "Alex",
    "persona": "friendly and professional",
    "greeting": "Hello! Welcome to {business_name}..."
  }
}
```

## API Endpoints

### Chat
- `POST /api/chat` - Send a message and get AI response
- `GET /api/chat/greeting` - Get initial greeting

### Appointments
- `GET /api/appointments/slots?date=YYYY-MM-DD&serviceId=xxx` - Get available slots
- `POST /api/appointments` - Book an appointment
- `GET /api/appointments/:id` - Get appointment details
- `DELETE /api/appointments/:id` - Cancel appointment

### Services
- `GET /api/services` - List all services
- `GET /api/services/:id` - Get service details
- `GET /api/services/business/info` - Get business info
- `GET /api/services/business/hours` - Get business hours

## Embedding the Widget

Add this to any website:

```html
<script>
  window.AIReceptionistConfig = {
    serverUrl: 'https://your-server.com'
  };
</script>
<script src="https://your-server.com/embed.js"></script>
```

Or build the widget for production:

```bash
cd frontend
npm run build
# Serve the dist/ folder with your backend
```

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express + Socket.IO server
│   │   ├── routes/           # API endpoints
│   │   ├── services/         # Business logic
│   │   ├── db/               # SQLite database
│   │   └── config/           # Configuration
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks
│   │   └── styles/           # CSS
│   └── package.json
├── .env.example
└── README.md
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GROQ_API_KEY` | Your Groq API key | Required |
| `PORT` | Backend server port | 3000 |
| `GROQ_MODEL` | Groq model to use | llama-3.1-70b-versatile |
| `FRONTEND_URL` | Allowed CORS origin | * |

## License

MIT
