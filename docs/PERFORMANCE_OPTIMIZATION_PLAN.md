# Performance Optimization Plan - Phase 2

## Backend Bottlenecks Identified

### 1. Dashboard Stats - 7 Sequential DB Queries
`getDashboardStats()` makes 7 separate database queries:
- Today appointments
- Week appointments  
- Month appointments
- Cancelled count
- Upcoming count
- Pending callbacks
- Top services

**Solution:** Combine into a single query with conditional aggregation

### 2. Chat Service - Synchronous DB Calls
Every chat message triggers:
- `getAllServices(true)` - DB query
- `getAllStaff(true)` - DB query

**Solution:** Cache services/staff with TTL (they rarely change)

### 3. Admin Dashboard API Calls
Each tab switch triggers fresh API calls with no caching.

**Solution:** Add client-side caching with SWR or React Query pattern

---

## Implementation Priority

### HIGH IMPACT (Backend)

1. **Optimize getDashboardStats** - Single query optimization
2. **Cache services/staff in ReceptionistService** - Reduce DB calls
3. **Add response caching headers** for static/semi-static data

### MEDIUM IMPACT (Frontend)  

4. **Add data caching between tab switches** - Prevent redundant API calls
5. **Implement skeleton loading** - Better perceived performance

---

## Quick Wins to Implement Now

1. Optimize getDashboardStats() with combined query
2. Add in-memory cache for services/staff (5 min TTL)
3. Add HTTP caching headers for /api/services endpoint
