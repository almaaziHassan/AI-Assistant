# AI Virtual Receptionist

[![CI/CD Pipeline](https://github.com/TellyQuest/AI-Assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/TellyQuest/AI-Assistant/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An AI-powered virtual receptionist chatbot that handles inquiries, schedules appointments, and provides information about your services. Built with Node.js, React, and Groq AI.

## 🌟 Features

- **AI Conversations**: Natural language understanding powered by Groq AI (Llama 3.1 70B).
- **Real-time Chat**: WebSocket-based (Socket.IO) for instant responses.
- **Smart Scheduling**: Integrated appointment booking with conflict detection.
- **Admin Dashboard**: secure panel to manage bookings and business settings.
- **Clean Architecture**: Built with Dependency Injection and Clean Code principles.
- **Robust Security**: Rate limiting, input validation, and secure headers.
- **Automated Quality**: Full CI/CD pipeline with automated testing.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm (v9+)
- Groq API key (get one at https://console.groq.com)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/TellyQuest/AI-Assistant.git
   cd AI-Assistant
   npm install # Installs git hooks (Husky)
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   cp ../.env.example .env
   # Edit .env and add your GROQ_API_KEY
   ```

3. **Frontend Setup:**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the App

**Development Mode:**
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

Visit `http://localhost:5173` to see the app.

## 🧪 Testing

We use centralized testing via GitHub Actions. You can run tests locally:

```bash
# Run all tests
npm test

# Run specific suite
cd backend && npm test
cd frontend && npm test
```

## 🏗️ Project Architecture

We follow a modular architecture with **Dependency Injection**:

```
├── backend/
│   ├── src/
│   │   ├── constants/        # Centralized constants (Time, Business Rules)
│   │   ├── middleware/       # Rate limiting, Validation, Error handling
│   │   ├── routes/           # Factory-style route definitions
│   │   ├── services/         # Business logic with D.I.
│   │   │   ├── receptionist/ # AI Logic
│   │   │   └── scheduler.ts  # Booking Logic
│   │   ├── socket/           # Real-time handlers
│   │   └── index.ts          # App Composition Root
│   └── tests/                # Unit and Integration tests
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── hooks/            # Custom logic hooks
│   │   └── utils/            # Formatters and helpers
└── docs/                     # Comprehensive documentation
```

## 📚 Documentation

- [**Developer Guide**](./docs/DEVELOPER_GUIDE.md): Setup, workflow, and standards.
- [**Contributing**](./CONTRIBUTING.md): How to submit PRs and code rules.
- [**Architecture Decisions**](./docs/KEY_DECISIONS.md): Why we chose this stack.
- [**API Reference**](./docs/API_REFERENCE.md): Detailed endpoint documentation.
- [**Production Setup**](./docs/PRODUCTION_SETUP.md): Deployment guide.

## ⚙️ Configuration

Edit `backend/src/config/services.json` to customize:
- **Business Info**: Name, address, phone.
- **Hours**: Opening/closing times.
- **Services**: Services offered, duration, and price.
- **Persona**: AI personality and greeting.

## 🔐 Security & Workflow

- **Branch Protection**: Direct commits to `main` are blocked. Use feature branches!
- **CI/CD**: All PRs are automatically tested and scanned.
- **Secrets**: Never commit `.env` files.

## 📄 License

MIT

