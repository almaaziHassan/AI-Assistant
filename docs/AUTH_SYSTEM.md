# 🔐 User Authentication System

This document covers the user authentication features, setup, and usage.

## Overview

The application supports two types of users:
1. **Admin Users** - Access the admin dashboard (session-based auth)
2. **End Users** - Book appointments, view history (JWT-based auth)

## Features

### User Authentication
- Email/password registration with validation
- Email verification (24-hour expiry)
- Password reset via email (1-hour expiry)
- Google OAuth integration
- JWT tokens (7-day expiry)

### User Dashboard
- **My Account** - View/edit profile, change password
- **My Appointments** - View, filter, cancel appointments

---

## Setup

### 1. Environment Variables

Add these to your `.env` file:

```bash
# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_secure_random_jwt_secret_here

# Frontend URL (for email links)
FRONTEND_URL=https://your-frontend.vercel.app

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
BACKEND_URL=https://your-backend.railway.app
```

### 2. Database Migration

The User model is already in the Prisma schema. Run migrations:

```bash
npx prisma migrate dev
```

### 3. Google OAuth Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable "Google+ API" or "Google People API"
4. Go to **Credentials** > **Create Credentials** > **OAuth client ID**
5. Application type: **Web application**
6. Add authorized redirect URIs:
   - Local: `http://localhost:3000/api/user-auth/google/callback`
   - Production: `https://your-backend.railway.app/api/user-auth/google/callback`
7. Copy Client ID and Client Secret to `.env`

---

## API Endpoints

### Registration & Login

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user-auth/register` | POST | Register new user |
| `/api/user-auth/login` | POST | Login and get JWT |
| `/api/user-auth/google` | GET | Initiate Google OAuth |
| `/api/user-auth/google/callback` | GET | OAuth callback |

### Email Verification

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user-auth/verify-email/:token` | GET | Verify email |
| `/api/user-auth/resend-verification` | POST | Resend verification email |

### Password Reset

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user-auth/forgot-password` | POST | Request reset email |
| `/api/user-auth/reset-password/:token` | POST | Reset password |

### User Profile (Requires Auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user-auth/me` | GET | Get current user |
| `/api/user-auth/profile` | PUT | Update profile |
| `/api/user-auth/change-password` | POST | Change password |

### User Appointments (Requires Auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/appointments` | GET | Get user's appointments |
| `/api/users/appointments/:id` | GET | Get specific appointment |
| `/api/users/appointments/:id/cancel` | PUT | Cancel appointment |
| `/api/users/stats` | GET | Get user statistics |

---

## Frontend Integration

### Using the Auth Hook

```tsx
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
  const { 
    user,           // Current user or null
    isAuthenticated, // Boolean
    isLoading,      // Loading state
    login,          // (email, password) => Promise
    register,       // (email, password, name) => Promise
    loginWithGoogle, // () => Promise
    logout,         // () => void
    updateUser      // (user) => void
  } = useAuth();

  if (isLoading) return <Loading />;
  
  if (!isAuthenticated) {
    return <LoginButton onClick={() => login(email, password)} />;
  }

  return <div>Welcome, {user.name}!</div>;
}
```

### Protecting Routes

```tsx
// In App.tsx
if (currentPage === 'account') {
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  return <UserAccountPage />;
}
```

### Auth Modal

```tsx
<AuthModal
  isOpen={authModalOpen}
  onClose={() => setAuthModalOpen(false)}
  initialView="login" // or "register"
  onSuccess={() => setAuthModalOpen(false)}
/>
```

---

## Security Features

### Password Hashing
- Uses **bcrypt** with 12 salt rounds
- Original password is never stored

### JWT Tokens
- Signed with HS256 algorithm
- Contains: userId, email, name, role
- 7-day expiry
- Stored in localStorage on frontend

### Rate Limiting
- Login: 5 attempts per 15 minutes per IP
- Registration: 10 per hour per IP
- API: 100 requests per minute per IP

### Email Verification
- Random 32-byte token
- 24-hour expiry
- Can't login until verified

### Password Reset
- Random 32-byte token
- 1-hour expiry
- Token cleared after use

---

## Data Model

```prisma
model User {
  id                   String    @id @default(cuid())
  email               String    @unique
  passwordHash        String?   // Optional for OAuth users
  name                String
  phone               String?
  role                UserRole  @default(customer)
  emailVerified       Boolean   @default(false)
  verificationToken   String?   @unique
  verificationExpires DateTime?
  resetToken          String?   @unique
  resetTokenExpires   DateTime?
  googleId            String?   @unique
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  lastLogin           DateTime?
  appointments        Appointment[]
}

enum UserRole {
  customer
  staff
  admin
}
```

---

## Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Duplicate email registration | Returns "Email already registered" |
| Weak password | Requires 8+ characters |
| Unverified email login | Returns "Please verify your email" |
| Google user tries password login | Returns "Please login with Google" |
| Expired verification token | Returns "Token has expired" |
| Expired reset token | Returns "Token has expired" |
| Popup blocked (OAuth) | Falls back to redirect |
| User closes OAuth popup | Cleans up event listeners |
| Appointments by different email | Matches by email, auto-links userId |
| Past appointment cancellation | Checks date AND time |

---

## Troubleshooting

### "Invalid email or password"
- Check email is correct
- Check password is correct
- Ensure account exists

### "Please verify your email"
- Check spam folder for verification email
- Use "Resend Verification" option

### Google OAuth redirects to localhost
- Ensure `BACKEND_URL` is set on Railway
- Check redirect URI in Google Console matches exactly

### "redirect_uri_mismatch"
- Add your production callback URL to Google Console
- Ensure no trailing slash in `BACKEND_URL`

---

## Design Decisions

### Why JWT instead of Sessions for Users?
- Stateless - works across multiple server instances
- Works well with mobile apps
- Easy to include in API requests
- 7-day expiry provides good balance of security/UX

### Why Session-based Auth for Admin?
- Simpler for browser-only access
- Easier to invalidate immediately
- Works with existing admin auth middleware

### Why both userId and email for appointment matching?
- Users may book before creating an account
- Email matching allows retroactive account linking
- Auto-links appointments when user logs in

---

## Future Enhancements

- [ ] Refresh tokens for seamless re-authentication
- [ ] Multi-factor authentication (2FA)
- [ ] Social login (Apple, Facebook)
- [ ] Account deletion with GDPR compliance
- [ ] Session management (view/revoke devices)
