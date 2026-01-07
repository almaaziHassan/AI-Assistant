/**
 * User Authentication Routes
 * Handles user registration, login, email verification, password reset
 */

import { Router, Request, Response } from 'express';
import { userAuthService } from '../services/userAuth';
import { requireUserAuth } from '../middleware/userAuth';
import { loginLimiter, apiLimiter } from '../middleware/rateLimiter';
import { validateEmail } from '../utils/validators';

const router = Router();

/**
 * POST /api/user-auth/register
 * Register a new user
 */
router.post('/register', apiLimiter, async (req: Request, res: Response) => {
    try {
        const { email, password, name, phone } = req.body;

        // Validate required fields
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        // Validate email format
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
            return res.status(400).json({ error: emailValidation.error });
        }

        const result = await userAuthService.register({
            email: emailValidation.sanitized,
            password,
            name: name.trim(),
            phone: phone?.trim()
        });

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email to verify your account.',
            user: result.user
        });
    } catch (error) {
        console.error('Register route error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * POST /api/user-auth/login
 * Login user and return JWT token
 */
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await userAuthService.login({ email, password });

        if (!result.success) {
            return res.status(401).json({ error: result.error });
        }

        res.json({
            success: true,
            user: result.user,
            token: result.token
        });
    } catch (error) {
        console.error('Login route error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * GET /api/user-auth/verify-email/:token
 * Verify user email with token
 */
router.get('/verify-email/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({ error: 'Verification token is required' });
        }

        const result = await userAuthService.verifyEmail(token);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            message: 'Email verified successfully',
            user: result.user,
            token: result.token
        });
    } catch (error) {
        console.error('Verify email route error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

/**
 * POST /api/user-auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', apiLimiter, async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const result = await userAuthService.resendVerificationEmail(email);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            message: 'If the email exists in our system, a verification email has been sent.'
        });
    } catch (error) {
        console.error('Resend verification route error:', error);
        res.status(500).json({ error: 'Failed to resend verification' });
    }
});

/**
 * POST /api/user-auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', apiLimiter, async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        await userAuthService.forgotPassword(email);

        // Always return success to prevent email enumeration
        res.json({
            success: true,
            message: 'If the email exists in our system, a password reset email has been sent.'
        });
    } catch (error) {
        console.error('Forgot password route error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

/**
 * POST /api/user-auth/reset-password/:token
 * Reset password with token
 */
router.post('/reset-password/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        const result = await userAuthService.resetPassword(token, password);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });
    } catch (error) {
        console.error('Reset password route error:', error);
        res.status(500).json({ error: 'Password reset failed' });
    }
});

/**
 * GET /api/user-auth/me
 * Get current logged-in user
 */
router.get('/me', requireUserAuth, async (req: Request, res: Response) => {
    try {
        const user = await userAuthService.getUserById(req.user!.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get me route error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

/**
 * PUT /api/user-auth/profile
 * Update user profile
 */
router.put('/profile', requireUserAuth, async (req: Request, res: Response) => {
    try {
        const { name, phone } = req.body;

        const result = await userAuthService.updateProfile(req.user!.id, { name, phone });

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            user: result.user
        });
    } catch (error) {
        console.error('Update profile route error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

/**
 * POST /api/user-auth/change-password
 * Change password (for logged-in users)
 */
router.post('/change-password', requireUserAuth, async (req: Request, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        const result = await userAuthService.changePassword(req.user!.id, currentPassword, newPassword);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password route error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

/**
 * POST /api/user-auth/logout
 * Logout (client-side token removal, server acknowledgment)
 */
router.post('/logout', (req: Request, res: Response) => {
    // JWT is stateless - logout is handled client-side by removing the token
    res.json({ success: true, message: 'Logged out successfully' });
});

// ==================== Google OAuth ====================

/**
 * GET /api/user-auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
        return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/user-auth/google/callback`;
    const scope = encodeURIComponent('openid email profile');
    const state = Buffer.from(JSON.stringify({ timestamp: Date.now() })).toString('base64');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${scope}` +
        `&state=${state}` +
        `&access_type=offline` +
        `&prompt=consent`;

    res.redirect(authUrl);
});

/**
 * GET /api/user-auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', async (req: Request, res: Response) => {
    try {
        const { code, error: oauthError } = req.query;

        if (oauthError) {
            console.error('Google OAuth error:', oauthError);
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?auth_error=google_denied`);
        }

        if (!code || typeof code !== 'string') {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?auth_error=missing_code`);
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/user-auth/google/callback`;

        if (!clientId || !clientSecret) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?auth_error=not_configured`);
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });

        const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

        if (!tokenData.access_token) {
            console.error('Failed to get tokens:', tokenData);
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?auth_error=token_failed`);
        }

        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        const googleUser = await userInfoResponse.json() as {
            id: string;
            email: string;
            name: string;
            picture?: string
        };

        if (!googleUser.email) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?auth_error=no_email`);
        }

        // Create or login user
        const result = await userAuthService.loginOrCreateWithGoogle({
            email: googleUser.email,
            name: googleUser.name || googleUser.email.split('@')[0],
            googleId: googleUser.id
        });

        if (!result.success || !result.token) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?auth_error=login_failed`);
        }

        // Return HTML that posts message to opener window
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Login Successful</title></head>
            <body>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({
                            type: 'oauth-success',
                            token: '${result.token}',
                            user: ${JSON.stringify(result.user)}
                        }, '${frontendUrl}');
                        window.close();
                    } else {
                        // Fallback: redirect with token in URL
                        window.location.href = '${frontendUrl}?auth_token=${result.token}';
                    }
                </script>
                <p>Login successful! You can close this window.</p>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Google callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?auth_error=server_error`);
    }
});

export default router;

