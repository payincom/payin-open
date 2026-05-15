/**
 * Test Fixtures for Processor Tests
 *
 * Centralized test credentials and configuration
 */

/**
 * Test mnemonic (hardcoded - only contains testnet funds, safe to commit)
 */
export const TEST_MNEMONIC = 'prepare panel behind window cram series basket exhibit topple icon solve gate';

/**
 * Test organization ID for single-org tests
 */
export const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Test database connection string
 * Priority: DB_CONNECTION_STRING > TEST_DATABASE_URL env > hardcoded fallback
 */
export const TEST_DATABASE_URL = process.env.DB_CONNECTION_STRING
  || process.env.TEST_DATABASE_URL
  || 'postgresql://postgres:postgres@localhost:5432/payin_test';

/**
 * Test RPC keys for blockchain monitoring
 */
export const TEST_RPC_KEYS = {
  alchemy: 'your_alchemy_key',
  infura: 'your_infura_key',
  trongrid: 'your_trongrid_key',
  ankr: 'your_helius_key'
};
