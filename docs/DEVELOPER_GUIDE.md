# Developer Quick Reference - Refactored Codebase

## Where to Find Things Now

### 🎨 Frontend

#### Date & Time Formatting
**File:** `frontend/src/utils/dateFormatters.ts`
```typescript
import { formatAppointmentDate, formatAppointmentTime, getPreferredTimeLabel } from '../utils/dateFormatters';

// Usage:
const formattedDate = formatAppointmentDate('2026-01-04'); // "Saturday, January 4, 2026"
const formattedTime = formatAppointmentTime('14:30'); // "2:30 PM"
const timeLabel = getPreferredTimeLabel('morning'); // "Morning (9am-12pm)"
```

---

### 🔧 Backend

#### Validation Utilities
**File:** `backend/src/utils/validators.ts`
```typescript
import { validateEmail, validatePhone, validateDate, sanitizeString } from '../utils/validators';

// Usage:
const emailResult = validateEmail('user@example.com');
if (emailResult.valid) {
  const clean = emailResult.sanitized; // 'user@example.com'
}
```

#### CORS Configuration
**File:** `backend/src/config/cors.ts`
```typescript
import { getExpressCorsConfig, getSocketCorsConfig } from './config/cors';

app.use(cors(getExpressCorsConfig()));
const io = new Server(httpServer, { cors: getSocketCorsConfig() });
```

#### Receptionist Service (Now Modular!)

**Main Service:**
```typescript
import { ReceptionistService } from './services/receptionist';
// This still works! It's re-exported from the module
```

**If you need to modify the receptionist:**

| Component | File | Purpose |
|-----------|------|---------|
| Main logic | `services/receptionist/index.ts` | Chat orchestration |
| AI Tools | `services/receptionist/tools.ts` | Function calling definitions |
| Prompt | `services/receptionist/promptBuilder.ts` | System prompt construction |
| Handlers | `services/receptionist/handlers.ts` | Booking/callback execution |
| Types | `services/receptionist/types.ts` | Shared interfaces |

**Example - Adding a new AI tool:**
1. Edit `services/receptionist/tools.ts`
2. Add your tool to the `getTools()` array
3. Handle it in `services/receptionist/index.ts` in the `chat()` method

#### Socket.IO

**Session Management:**
```typescript
import { initializeSession, mapSocketToSession } from './socket/sessionManager';

// Sessions are now managed centrally
const { sessionId, isNewSession, history } = initializeSession(existingSessionId);
```

**Event Handlers:**
```typescript
import { handleConnection } from './socket/handlers';

io.on('connection', handleConnection);
// All socket events (init, message, saveConfirmation, disconnect) handled internally
```

---

## Common Tasks

### Adding a New Validation Rule

**File:** `backend/src/utils/validators.ts`
```typescript
export function validateCustomField(value: string): { valid: boolean; error?: string } {
  // Your validation logic
  if (!someCondition) {
    return { valid: false, error: 'Validation failed' };
  }
  return { valid: true };
}
```

Then use it in your middleware or service:
```typescript
import { validateCustomField } from '../utils/validators';
```

### Modifying the AI Prompt

**File:** `backend/src/services/receptionist/promptBuilder.ts`

The `buildSystemPrompt()` function is broken into sections:
- Response rules
- Business info
- Services & staff
- FAQs
- Industry knowledge

Edit the relevant section and it will automatically update the prompt.

### Adding a New Date Formatter

**File:** `frontend/src/utils/dateFormatters.ts`
```typescript
export function formatNewStyle(dateStr: string): string {
  // Your formatting logic
  return formattedString;
}
```

### Modifying Socket Event Handlers

**File:** `backend/src/socket/handlers.ts`

Each event has its own function:
- `handleInit()` - Session initialization
- `handleMessage()` - Incoming user messages
- `handleSaveConfirmation()` - Save confirmations
- `handleDisconnect()` - Cleanup on disconnect

Simply modify the relevant function.

---

## Import Cheat Sheet

### Frontend
```typescript
// Date utilities
import { formatAppointmentDate, formatAppointmentTime } from '../utils/dateFormatters';

// Existing imports (unchanged)
import { useChat } from '../hooks/useChat';
import ChatWidget from '../components/ChatWidget';
```

### Backend
```typescript
// Validation
import { validateEmail, validatePhone, sanitizeString } from '../utils/validators';

// CORS
import { getExpressCorsConfig, getSocketCorsConfig } from '../config/cors';

// Socket
import { handleConnection } from '../socket/handlers';
import { initializeSession } from '../socket/sessionManager';

// Services (unchanged - still works!)
import { ReceptionistService } from '../services/receptionist';
import { SchedulerService } from '../services/scheduler';
import { adminService } from '../services/admin';
```

---

## Testing Checklist

When making changes, verify:

### Backend
```bash
cd backend
npm run build    # Should complete without errors
npm test         # If you have tests
```

### Frontend
```bash
cd frontend
npm run build    # Should complete without errors
npm run dev      # Test in browser
```

### Full Stack
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Test key flows:
   - ✓ Chat initialization
   - ✓ Appointment booking
   - ✓ Callback requests
   - ✓ Admin login

---

## File Size Guide

✅ **Good:** < 300 lines per file
⚠️ **Review:** 300-500 lines
❌ **Refactor:** > 500 lines

After refactoring:
- ✅ Most files are under 250 lines
- ✅ Largest new files ~200 lines (prompt builder, socket handlers)
- Note: `scheduler.ts` (748) and `admin.ts` (524) were left unchanged for safety

---

## Backward Compatibility

**All existing code still works!**

These imports are unchanged:
```typescript
import { ReceptionistService } from './services/receptionist';
import { validateEmail } from './middleware/validation'; // Still re-exported
```

The refactoring is **internal** - we extracted code into modules but maintained all public APIs.

---

## Questions?

Common scenarios:

**Q: Where is the receptionist code now?**  
A: Split into `services/receptionist/` folder. Import from `services/receptionist` still works.

**Q: Where are validation functions?**  
A: `backend/src/utils/validators.ts` for shared validators. Middleware still exports them for backward compatibility.

**Q: The main server file looks different!**  
A: Yes! We extracted Socket.IO and CORS to separate modules. Check `socket/handlers.ts` and `config/cors.ts`.

**Q: Will my existing code break?**  
A: No! All exports are maintained. We only reorganized internally.

**Q: Can I still add features?**  
A: Yes! The new structure makes it easier. Each component has a clear home now.

---

## Quick Navigation

```
📁 Need to modify...                    📄 Go to...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Date formatting (frontend)          → utils/dateFormatters.ts
Validation logic                    → utils/validators.ts
CORS settings                       → config/cors.ts
AI conversation tools               → services/receptionist/tools.ts
AI prompt/personality               → services/receptionist/promptBuilder.ts
Booking/callback execution          → services/receptionist/handlers.ts
Socket event handling               → socket/handlers.ts
Session management                  → socket/sessionManager.ts
Server startup/routes               → index.ts
```

---

**Remember:** The refactoring made the code cleaner and more maintainable, but everything still works exactly as before! 🎉
