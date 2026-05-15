/**
 * Database Utilities
 * Provides database initialization and management
 */

import { Pool } from 'pg';
import { ALL_SCHEMAS, TABLE_NAMES } from './schema.js';
import { createLogger, LogCategory } from '@payin/shared';

const logger = createLogger(LogCategory.NOTIFICATION);

/**
 * Initialize notification database tables
 *
 * @param connectionString - PostgreSQL connection string
 * @returns Pool instance
 */
export async function initializeDatabase(connectionString: string): Promise<Pool> {
  const pool = new Pool({ connectionString });

  logger.info('Initializing notification database...');

  try {
    // Create tables
    for (const schema of ALL_SCHEMAS) {
      await pool.query(schema);
    }

    logger.info('Notification database initialized successfully');
    return pool;
  } catch (error) {
    logger.error('Failed to initialize notification database:', error);
    throw error;
  }
}

/**
 * Drop all notification tables (for testing)
 *
 * @param pool - Database pool
 */
export async function dropAllTables(pool: Pool): Promise<void> {
  logger.warn('Dropping all notification tables...');

  try {
    // Drop in reverse order to handle foreign key constraints
    const reversedTableNames = [...TABLE_NAMES].reverse();
    for (const tableName of reversedTableNames) {
      await pool.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
    }

    logger.info('All notification tables dropped');
  } catch (error) {
    logger.error('Failed to drop tables:', error);
    throw error;
  }
}

/**
 * Check if tables exist
 *
 * @param pool - Database pool
 * @returns true if all tables exist
 */
export async function tablesExist(pool: Pool): Promise<boolean> {
  try {
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
    `;

    const result = await pool.query(query, [TABLE_NAMES]);
    return result.rows.length === TABLE_NAMES.length;
  } catch (error) {
    logger.error('Failed to check tables:', error);
    return false;
  }
}
