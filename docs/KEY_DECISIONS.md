# 🏗️ Architecture & Key Decisions

This document records the significant architectural decisions made during the development of the AI Virtual Receptionist.

## 1. Technology Stack

### Backend: Node.js + Express
- **Decision**: Use Node.js with TypeScript.
- **Why**: 
  - Non-blocking I/O is ideal for handling concurrent WebSocket connections.
  - TypeScript provides type safety and better developer experience.
  - Vast ecosystem for AI and DB integrations.

### AI Engine: Groq (Llama 3.1 70B)
- **Decision**: Use Groq API with Llama 3.1.
- **Why**: 
  - **Speed**: Groq is significantly faster than traditional LLM providers, essential for a "real-time" chat feel.
  - **Performance**: Llama 3.1 70B offers GPT-4 class reasoning at a lower latency.
  - **Cost**: Efficient pricing structure.

### Database: SQLite
- **Decision**: Use SQLite for local persistence.
- **Why**: 
  - Zero configuration required (easy setup).
  - File-based system simplifies backup and transfer.
  - Sufficient performance for the initial scale of a small business receptionist.
  - **Future Proofing**: Database interaction is abstracted via helper functions, allowing easy migration to Postgres if needed.

### Real-time: Socket.IO
- **Decision**: Use Socket.IO over raw WebSockets.
- **Why**: 
  - Automatic reconnection logic.
  - Fallback to polling if WebSockets are blocked.
  - Room-based event broadcasting (useful for future multi-agent or multi-user features).

---

## 2. Design Patterns

### Dependency Injection (DI)
- **Decision**: Implement manual Dependency Injection for Services and Routes.
- **Why**: 
  - **Testability**: Allows us to inject mock services (like a MockGroqService) during unit tests without making actual API calls.
  - **Decoupling**: Routes don't know *how* a service works, only *what* it does.
  - **Implementation**: We use Factory Functions (`createRouter`) instead of a heavy framework like NestJS to keep the codebase lightweight.

### Clean Code & Constants
- **Decision**: Centralize all "magic numbers" in `src/constants/`.
- **Why**: 
  - Determines business logic (e.g., `CANCELLATION_NOTICE_HOURS`) in one place.
  - Makes code readable (`RATE_LIMIT_WINDOWS.GENERAL_API` vs `900000`).
  - Reduces bugs from mismatched values.

### Factory Pattern for Routes
- **Decision**: Export `createRouter(dependencies)` instead of a static router.
- **Why**: Enables injecting dependencies (Services) into the router at runtime/test-time.

---

## 3. Security Decisions

### Local Branch Protection
- **Decision**: Use `Husky` pre-commit hooks.
- **Why**: GitHub Branch Protection is not available for private free repositories. Husky ensures no one accidentally commits to `main` locally.

### Rate Limiting
- **Decision**: Implement per-IP rate limiting using `express-rate-limit`.
- **Why**: Prevents abuse of the AI API (which costs money/tokens) and protects against DoS attacks.

### Frontend-Backend Separation
- **Decision**: Keep Frontend (Vite) and Backend (Node) in separate folders but one repo (Monorepo-lite).
- **Why**: 
  - Simplifies deployment (can deploy separately).
  - Clear separation of concerns.
  - Share types/contracts easily if needed in the future.

---

## 4. Future Roadmap / Known Trade-offs

- **SQLite**: Will need migration to PostgreSQL for multi-tenant support.
- **Memory**: Chat history is currently in-memory (or DB) but context window management needs refinement for very long conversations.
- **Horizontal Scaling**: Socket.IO requires a Redis adapter to scale across multiple server instances (currently single instance).
