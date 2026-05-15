/**
 * Database Initialization Helper
 * Determines whether to initialize database based on explicit INIT_DB flag
 */

/**
 * Check if database should be initialized
 *
 * Rule: Only initialize when INIT_DB=true is explicitly set
 * - INIT_DB=true: Drop and recreate all tables (clean slate)
 * - INIT_DB=false or unset: Do nothing (safe default)
 *
 * @returns true if database should be initialized
 */
export function shouldAutoInitDatabase(): boolean {
  return process.env.INIT_DB === 'true';
}

/**
 * Get database initialization options
 *
 * When INIT_DB=true, always:
 * - Drop all existing tables
 * - Recreate all tables from scratch
 * - Clear all data
 *
 * @returns Initialization options for database schema
 */
export function getAutoInitOptions() {
  return {
    dropExisting: true,   // Drop all existing tables
    onlyMissing: false,   // Recreate all tables (not just missing)
    force: true,          // No confirmation needed
  };
}
