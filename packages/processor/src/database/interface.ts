/**
 * Database Interface
 * Common interface for database operations
 */

export interface DatabaseInterface {
  query(sql: string, params?: any[]): Promise<any[]>;
  execute(sql: string, params?: any[]): Promise<{ affectedRows: number; insertId?: number }>;
  initialize(): Promise<void>;
  close(): Promise<void>;
}