import { describe, expect, it, vi } from 'vitest';
import { TransferRepository } from '../../src/repositories/transfer.repository.js';

function createDb() {
  return { query: vi.fn(async () => []) } as any;
}

describe('TransferRepository scope filters', () => {
  it('filters transaction hash lookup by organization when scope is provided', async () => {
    const db = createDb();
    const repo = new TransferRepository(db);

    await repo.findByTransactionHash('0xtx', 'org-1');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('transaction_hash = $1 AND organization_id = $2'),
      ['0xtx', 'org-1']
    );
  });

  it('filters order transfer lookup by organization when scope is provided', async () => {
    const db = createDb();
    const repo = new TransferRepository(db);

    await repo.findByOrderId('order-1', 'org-1');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('order_id = $1 AND organization_id = $2'),
      ['order-1', 'org-1']
    );
  });

  it('filters deposit transfer lookup by organization when scope is provided', async () => {
    const db = createDb();
    const repo = new TransferRepository(db);

    await repo.findByDepositReference('customer-1', 'org-1');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('deposit_reference = $1 AND organization_id = $2'),
      ['customer-1', 'org-1']
    );
  });
});
