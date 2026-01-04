# Admin Dashboard Refactoring Plan

## Current State
- **AdminDashboard.tsx**: 1,513 lines (CRITICAL)
- Violates Single Responsibility Principle
- Handles: Auth, Stats, Appointments, Staff, Services, Holidays, Callbacks, Calendar

## Target Structure

```
frontend/src/
├── hooks/
│   ├── useAdminAuth.ts ✅ DONE (142 lines)
│   ├── useAdminData.ts - Data fetching & state management
│   └── useCallbackFilters.ts - Callback filtering logic
├── components/
│   └── admin/
│       ├── AdminDashboard.tsx - Main orchestrator (~200 lines)
│       ├── AdminLogin.tsx - Login form
│       ├── AdminStats.tsx - Dashboard overview tab
│       ├── AdminAppointments.tsx - Appointments tab
│       ├── AdminCallbacks.tsx - Callbacks tab
│       ├── AdminStaff.tsx - Staff management tab
│       ├── AdminServices.tsx - Services management tab
│       └── AdminHolidays.tsx - Holidays tab
└── types/
    └── admin.ts - Shared interfaces
```

## Implementation Steps

### ✅ Step 1: Extract Auth Hook (DONE)
- Created `useAdminAuth.ts`
- Handles login/logout/session verification
- Reduced AdminDashboard by ~140 lines

### 🔄 Step 2: Extract TypeScript Interfaces
- Move all interfaces to `types/admin.ts`
- Makes types reusable across components
- **Estimated reduction: ~100 lines**

### ⏳ Step 3: Extract Data Fetching Hook
- Create `useAdminData.ts`
- Handles fetchData(), fetchCallbacks(), etc.
- **Estimated reduction: ~200 lines**

### ⏳ Step 4: Extract Tab Components
- **AdminStats.tsx** - Overview tab (~150 lines)
- **AdminAppointments.tsx** - Appointments + Calendar (~300 lines)
- **AdminCallbacks.tsx** - Callbacks tab (~150 lines)
- **AdminStaff.tsx** - Staff management (~250 lines)
- **AdminServices.tsx** - Services management (~150 lines)
- **AdminHolidays.tsx** - Holidays management (~100 lines)

### ⏳ Step 5: Create Login Component
- **AdminLogin.tsx** - Separate login screen (~80 lines)

### ⏳ Step 6: Update Main AdminDashboard
- Keep only: Tab routing, layout, authentication check
- Import all extracted components
- **Target: ~200 lines**

## Benefits

1. **Maintainability**: Each file has clear responsibility
2. **Testability**: Extracted hooks & components easier to test
3. **Reusability**: Hooks can be reused in other admin components
4. **Performance**: Easier to optimize re-renders per tab
5. **Collaboration**: Multiple devs can work on different tabs

## Progress

- [x] useAdminAuth.ts (142 lines)
- [ ] types/admin.ts
- [ ] useAdminData.ts
- [ ] Tab components (6)
- [ ] AdminLogin.tsx
- [ ] Update main AdminDashboard.tsx

**Next**: Extract TypeScript interfaces to `types/admin.ts`
