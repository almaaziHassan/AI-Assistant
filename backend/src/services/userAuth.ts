/**
 * User Authentication Service
 * Handles user registration, login, email verification, and password reset
 */

import { PrismaClient, User, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { emailService } from './email';

const prisma = new PrismaClient();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
const JWT_EXPIRES_IN = '7d'; // User tokens last 7 days
const VERIFICATION_EXPIRES_HOURS = 24;
const RESET_TOKEN_EXPIRES_HOURS = 1;

// Types
export interface RegisterInput {
    email: string;
    password: string;
    name: string;
    phone?: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface UserPayload {
    id: string;
    email: string;
    name: string;
    role: UserRole;
}

export interface AuthResult {
    success: boolean;
    user?: UserPayload;
    token?: string;
    error?: string;
}

class UserAuthService {
    /**
     * Register a new user
     */
    async register(input: RegisterInput): Promise<AuthResult> {
        try {
            const { email, password, name, phone } = input;

            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });

            if (existingUser) {
                return { success: false, error: 'Email already registered' };
            }

            // Validate password strength
            if (password.length < 8) {
                return { success: false, error: 'Password must be at least 8 characters' };
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 12);

            // Generate verification token
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationExpires = new Date(Date.now() + VERIFICATION_EXPIRES_HOURS * 60 * 60 * 1000);

            // Create user
            const user = await prisma.user.create({
                data: {
                    email: email.toLowerCase(),
                    passwordHash,
                    name,
                    phone,
                    verificationToken,
                    verificationExpires,
                    role: 'customer'
                }
            });

            // Send verification email
            await this.sendVerificationEmail(user.email, user.name, verificationToken);

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                }
            };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Registration failed. Please try again.' };
        }
    }

    /**
     * Login user
     */
    async login(input: LoginInput): Promise<AuthResult> {
        try {
            const { email, password } = input;

            // Find user
            const user = await prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });

            if (!user) {
                return { success: false, error: 'Invalid email or password' };
            }

            // Check password
            const isValidPassword = await bcrypt.compare(password, user.passwordHash);
            if (!isValidPassword) {
                return { success: false, error: 'Invalid email or password' };
            }

            // Check if email is verified
            if (!user.emailVerified) {
                return { success: false, error: 'Please verify your email before logging in' };
            }

            // Generate JWT token
            const token = this.generateToken(user);

            // Update last login
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: new Date() }
            });

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
                token
            };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Login failed. Please try again.' };
        }
    }

    /**
     * Verify email with token
     */
    async verifyEmail(token: string): Promise<AuthResult> {
        try {
            const user = await prisma.user.findUnique({
                where: { verificationToken: token }
            });

            if (!user) {
                return { success: false, error: 'Invalid verification token' };
            }

            if (user.verificationExpires && user.verificationExpires < new Date()) {
                return { success: false, error: 'Verification token has expired. Please request a new one.' };
            }

            // Mark email as verified
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    emailVerified: true,
                    verificationToken: null,
                    verificationExpires: null
                }
            });

            // Generate login token
            const authToken = this.generateToken(user);

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
                token: authToken
            };
        } catch (error) {
            console.error('Verify email error:', error);
            return { success: false, error: 'Verification failed. Please try again.' };
        }
    }

    /**
     * Request password reset
     */
    async forgotPassword(email: string): Promise<{ success: boolean; error?: string }> {
        try {
            const user = await prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });

            // Always return success to prevent email enumeration
            if (!user) {
                return { success: true };
            }

            // Generate reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpires = new Date(Date.now() + RESET_TOKEN_EXPIRES_HOURS * 60 * 60 * 1000);

            await prisma.user.update({
                where: { id: user.id },
                data: { resetToken, resetTokenExpires }
            });

            // Send password reset email
            await this.sendPasswordResetEmail(user.email, user.name, resetToken);

            return { success: true };
        } catch (error) {
            console.error('Forgot password error:', error);
            return { success: false, error: 'Failed to process request. Please try again.' };
        }
    }

    /**
     * Reset password with token
     */
    async resetPassword(token: string, newPassword: string): Promise<AuthResult> {
        try {
            const user = await prisma.user.findUnique({
                where: { resetToken: token }
            });

            if (!user) {
                return { success: false, error: 'Invalid reset token' };
            }

            if (user.resetTokenExpires && user.resetTokenExpires < new Date()) {
                return { success: false, error: 'Reset token has expired. Please request a new one.' };
            }

            // Validate password strength
            if (newPassword.length < 8) {
                return { success: false, error: 'Password must be at least 8 characters' };
            }

            // Hash new password
            const passwordHash = await bcrypt.hash(newPassword, 12);

            // Update password and clear reset token
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash,
                    resetToken: null,
                    resetTokenExpires: null
                }
            });

            return { success: true };
        } catch (error) {
            console.error('Reset password error:', error);
            return { success: false, error: 'Password reset failed. Please try again.' };
        }
    }

    /**
     * Get user by ID
     */
    async getUserById(id: string): Promise<UserPayload | null> {
        try {
            const user = await prisma.user.findUnique({
                where: { id }
            });

            if (!user) return null;

            return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            };
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(userId: string, data: { name?: string; phone?: string }): Promise<AuthResult> {
        try {
            const user = await prisma.user.update({
                where: { id: userId },
                data: {
                    name: data.name,
                    phone: data.phone
                }
            });

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                }
            };
        } catch (error) {
            console.error('Update profile error:', error);
            return { success: false, error: 'Failed to update profile' };
        }
    }

    /**
     * Change password (for logged-in users)
     */
    async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isValidPassword) {
                return { success: false, error: 'Current password is incorrect' };
            }

            // Validate new password
            if (newPassword.length < 8) {
                return { success: false, error: 'New password must be at least 8 characters' };
            }

            // Hash and update password
            const passwordHash = await bcrypt.hash(newPassword, 12);
            await prisma.user.update({
                where: { id: userId },
                data: { passwordHash }
            });

            return { success: true };
        } catch (error) {
            console.error('Change password error:', error);
            return { success: false, error: 'Failed to change password' };
        }
    }

    /**
     * Verify JWT token and return user payload
     */
    verifyToken(token: string): UserPayload | null {
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
            return decoded;
        } catch {
            return null;
        }
    }

    /**
     * Resend verification email
     */
    async resendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
        try {
            const user = await prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });

            if (!user) {
                return { success: true }; // Don't reveal if email exists
            }

            if (user.emailVerified) {
                return { success: false, error: 'Email is already verified' };
            }

            // Generate new verification token
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationExpires = new Date(Date.now() + VERIFICATION_EXPIRES_HOURS * 60 * 60 * 1000);

            await prisma.user.update({
                where: { id: user.id },
                data: { verificationToken, verificationExpires }
            });

            await this.sendVerificationEmail(user.email, user.name, verificationToken);

            return { success: true };
        } catch (error) {
            console.error('Resend verification error:', error);
            return { success: false, error: 'Failed to resend verification email' };
        }
    }

    // Private methods

    private generateToken(user: User): string {
        const payload: UserPayload = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        };

        return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    }

    private async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
        const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;

        await emailService.sendEmail({
            to: email,
            subject: 'Verify your email - Serenity Wellness Spa',
            html: `
        <h2>Welcome to Serenity Wellness Spa, ${name}!</h2>
        <p>Thank you for registering. Please verify your email address by clicking the link below:</p>
        <p><a href="${verifyUrl}" style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email</a></p>
        <p>Or copy and paste this link in your browser:</p>
        <p>${verifyUrl}</p>
        <p>This link will expire in ${VERIFICATION_EXPIRES_HOURS} hours.</p>
        <p>If you didn't create an account, you can safely ignore this email.</p>
      `
        });
    }

    private async sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

        await emailService.sendEmail({
            to: email,
            subject: 'Reset your password - Serenity Wellness Spa',
            html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}" style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a></p>
        <p>Or copy and paste this link in your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in ${RESET_TOKEN_EXPIRES_HOURS} hour(s).</p>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
      `
        });
    }
}

export const userAuthService = new UserAuthService();
