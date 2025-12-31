# Bug Fix: Time Slots Not Appearing - Race Condition & Configuration Issues

## Date Fixed
December 30, 2024

## Summary
Users were unable to see available time slots when booking appointments. The UI would either show no slots, or display an incorrect error message (e.g., "No available times on Friday" for a Wednesday date).

---

## Root Causes Identified

### 1. Race Condition in Date Input (Frontend)
**Problem:** When users typed a date into the date input field, multiple API requests were fired rapidly during the typing process. Responses arrived out of order, causing stale data to overwrite valid data.

**Example Scenario:**
- User types `12312025` for December 31, 2025
- Browser interprets intermediate states: `0002-12-31`, `0020-12-31`, `0201-12-31`, `2012-12-31`, `2020-12-31`, etc.
- API requests fire for each intermediate date
- Response for `2020-12-31` (a Friday) arrives AFTER the response for `2025-12-31` (Wednesday)
- UI displays: "No available times on Friday" for a Wednesday date

**Files Affected:**
- `frontend/src/components/AppointmentForm.tsx`

### 2. Missing Cleanup Function in React useEffect (Frontend)
**Problem:** When the date input was invalid (year < 2024), the useEffect returned early WITHOUT returning a cleanup function. This meant previous pending requests weren't cancelled, allowing stale responses to still update the UI.

### 3. Stale Closure Bug (Frontend)
**Problem:** The `formData.date` variable used in the `.then()` callback referred to the state at the time the callback was defined, not when it executed. By the time the API response arrived, `formData.date` had already changed.

### 4. Vercel Build Cache (Deployment)
**Problem:** Vercel was caching old builds and not deploying new code, even after pushing commits. The JS bundle hash remained the same across multiple deployments.

---

## Fixes Applied

### Fix 1: Added 400ms Debounce
Wait 400ms after the user stops typing before making an API request.

```typescript
// Debounce: wait 400ms before making the request
timeoutId = setTimeout(() => {
  // ...fetch logic
}, 400);
```

### Fix 2: Year Validation
Skip API requests for years before 2024 (no one books appointments in the past):

```typescript
const year = parseInt(dateMatch[1], 10);
if (year < 2024 || year > 2100) {
  return; // Invalid year, skip fetch
}
```

### Fix 3: Capture Values in Closure
Capture form data at the start of the effect to prevent stale references:

```typescript
// Capture values in closure to prevent stale reference
const requestDate = formData.date;
const requestServiceId = formData.serviceId;
const requestStaffId = formData.staffId;

// Later in the .then() callback, use requestDate instead of formData.date
const dayName = new Date(requestDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
```

### Fix 4: Always Return Cleanup Function
Ensure the cleanup function ALWAYS runs, regardless of early returns:

```typescript
let timeoutId: ReturnType<typeof setTimeout> | null = null;

// ... validation logic ...

timeoutId = setTimeout(() => { /* fetch */ }, 400);

// ALWAYS return cleanup
return () => {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  abortController.abort();
};
```

### Fix 5: AbortController for Stale Requests
Cancel previous fetch requests when a new one is initiated:

```typescript
const abortController = new AbortController();

fetch(url, { signal: abortController.signal })
  .then(data => {
    // Double-check request wasn't cancelled
    if (abortController.signal.aborted) {
      return;
    }
    // Process data...
  })
  .catch(err => {
    if (err.name === 'AbortError') {
      return; // Expected, ignore
    }
  });
```

### Fix 6: Force Vercel Cache Invalidation
Added an exported constant that changes with each deployment:

```typescript
// Build version - increment to force cache invalidation
export const BUILD_VERSION = '2024123002';
```

---

## Files Modified

| File | Changes |
|------|---------|
| `frontend/src/components/AppointmentForm.tsx` | Added debounce, closure capture, cleanup function, abort controller, year validation |
| `frontend/package.json` | Bumped version to force rebuild |

---

## Commits

1. `436cc89` - Fix: Race condition - AbortController cancels stale requests, validate year before fetching
2. `602afb0` - Fix: Check available slot count, not total slots, to properly show closed message
3. `3576adc` - Fix: Add 300ms debounce and fix stale closure for date in slot fetching
4. `b15349e` - Fix: Always return cleanup function, increase debounce to 400ms, require year >= 2024
5. `0fbade7` - Fix: Export BUILD_VERSION to fix TypeScript unused variable error

---

## Testing Verification

After fixes:
- ✅ Time slots appear correctly for valid dates
- ✅ Correct day name displays (Wednesday for Dec 31, 2025)
- ✅ No race condition when typing dates
- ✅ Staff selection works
- ✅ Multiple bookings can be made

---

## Lessons Learned

1. **Debounce user input** when it triggers API calls
2. **Capture state in closures** at the start of async operations
3. **Always return cleanup functions** in React useEffect
4. **Use AbortController** to cancel stale fetch requests
5. **Validate input early** to prevent unnecessary API calls
6. **Clear build caches** when deployments don't reflect code changes
