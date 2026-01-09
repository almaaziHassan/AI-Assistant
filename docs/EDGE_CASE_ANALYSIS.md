# Edge Case Analysis - Recent Features

## Session: January 9, 2026

### Feature 1: Dashboard Page & Auto-redirect

| Edge Case | Expected Behavior | Status |
|-----------|-------------------|--------|
| Unauthenticated user visits #/dashboard | Redirect to landing page | ✅ Fixed - useEffect redirects |
| Token expires while on dashboard | Should redirect to login | ✅ isAuthenticated becomes false |
| User refreshes dashboard page | Should stay on dashboard if authenticated | ✅ URL hash preserved |
| Browser back button from dashboard | Should work correctly | ✅ Hash routing works |
| Slow network during dashboard load | Show loading state | ✅ Suspense fallback |

### Feature 2: Link Appointments to User (userId)

| Edge Case | Expected Behavior | Status |
|-----------|-------------------|--------|
| Book while NOT logged in | Appointment saved without userId | ✅ userId is undefined |
| Book while logged in | Appointment saved WITH userId | ✅ user?.id passed |
| userId is undefined | Should handle gracefully, save null | ✅ Prisma handles null |
| User logs in AFTER booking with same email | Should see old + new appointments | ✅ Query uses OR |

### Feature 3: Appointment Ownership Query  

| Edge Case | Expected Behavior | Status |
|-----------|-------------------|--------|
| Appointments with null userId AND different email | Should NOT show for any user | ✅ Correct |
| User has NO appointments | Empty state shown | ✅ Empty state component |
| Cancelled appointments | Should show in past tab | ✅ FIXED - Removed status filter |
| Query with both userId and email params | Works correctly | ✅ Tested |
| Query with only userId | Works correctly | ✅ Tested |
| Query with only email | Works correctly | ✅ Tested |

### Feature 4: Reschedule Button

| Edge Case | Expected Behavior | Status |
|-----------|-------------------|--------|
| Appointment doesn't exist (deleted) | Show error message | ✅ Error handling in catch |
| Network error during fetch | Handle gracefully | ✅ Console error + message |
| User clicks reschedule, chat already open | Focus existing chat | ✅ setChatOpen(true) |
| Reschedule same appointment twice quickly | Prevent double action | ⚠️ Could add loading state |
| Appointment in the past | Should not show reschedule | ✅ Only in upcoming tab |

### Feature 5: User-specific Chat History

| Edge Case | Expected Behavior | Status |
|-----------|-------------------|--------|
| User logs out while chat open | Clear messages, disconnect | ✅ Socket reconnects with null |
| User logs in (was guest) | Load new user's history | ✅ Socket reconnects |
| Token expires during session | Handle gracefully | ✅ verifyToken returns null |
| Socket disconnect/reconnect | Restore connection with same session | ✅ useEffect cleanup |
| Switch between users quickly | Clear old, load new history | ✅ FIXED - reactive authToken |

### Feature 6: Past Appointments Tab

| Edge Case | Expected Behavior | Status |
|-----------|-------------------|--------|
| Appointment happening RIGHT NOW | Should be in upcoming | ✅ aptDateTime < now |
| Appointment just ended (seconds ago) | Should move to past | ✅ Time comparison works |
| Cancelled future appointment | Should show in past tab | ✅ Status check in filter |
| Completed future appointment | Should show in past tab | ✅ Status check in filter |
| Timezone: Server vs Client | Use client timezone for display | ⚠️ Consider timezone |
| Empty past appointments | Show empty state | ✅ Empty state component |
| Many past appointments | All shown (no limit) | ✅ No slice applied |
| Invalid date parsing | Treat as upcoming (safe default) | ✅ FIXED - NaN check added |

---

## Fixes Applied This Session

### 1. Cancelled Appointments Not Showing in Past Tab
**Problem:** Backend query filtered out cancelled appointments with `status: { not: 'cancelled' }`
**Fix:** Removed the status filter from `/my-appointments` query. Frontend handles filtering.

### 2. Date Parsing Edge Case
**Problem:** If time string was malformed, `new Date()` could return Invalid Date
**Fix:** Added explicit seconds to time format and NaN check with safe fallback

### 3. Auth Token Not Reactive
**Problem:** `authToken` was read from localStorage at mount, not reactive to login/logout
**Fix:** Now derived from `user` state, so when user changes, authToken updates and socket reconnects

---

## Remaining Considerations

1. **Double-click protection on Reschedule** - Could add loading state to prevent rapid clicks
2. **Timezone handling** - Server stores UTC, client displays local. May need explicit timezone handling for edge cases
3. **Token refresh** - Long sessions may need token refresh logic

