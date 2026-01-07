/**
 * Auth Services Index
 * 
 * Re-exports all auth-related services for convenient importing
 * 
 * Directory Structure (SOLID principles):
 * - password.ts: Password hashing/validation (Single Responsibility)
 * - token.ts: Token generation for verification/reset (Single Responsibility)
 * - ../userAuth.ts: Main auth service (orchestrates the above)
 * - ../../utils/jwt.ts: JWT token handling (already extracted)
 */

export { PasswordService, passwordService } from './password';
export { TokenService, tokenService, VERIFICATION_EXPIRES_HOURS, RESET_TOKEN_EXPIRES_HOURS } from './token';
