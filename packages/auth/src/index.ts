/**
 * @payin/auth - Authentication and Authorization Module
 */

export { AuthManager, type AuthManagerOptions } from './auth-manager.js';
export { OrganizationManager } from './organization-manager.js';
export {
  SocialAuthService,
  type SocialAuthServiceOptions,
  type OAuthCallbackResult
} from './social-auth-service.js';
export {
  DirectOAuthService,
  type DirectOAuthServiceOptions,
} from './direct-oauth-service.js';

export * from './types/index.js';
export * from './permissions.js';
export * from './middleware/index.js';
export * from './database/schema.js';
export * from './validation.js';
