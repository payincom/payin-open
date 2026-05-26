import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveManagerConfigPath } from '../src/config.js';

describe('resolveManagerConfigPath', () => {
  it('resolves bare manager config filenames relative to apps/api/config', () => {
    expect(resolveManagerConfigPath('manager.testnet.yaml')).toBe(
      resolve(process.cwd(), 'apps/api/config/manager.testnet.yaml')
    );
  });

  it('resolves deployment-style repo-relative paths from cwd instead of duplicating apps/api/config', () => {
    expect(resolveManagerConfigPath('apps/api/config/manager.testnet.yaml')).toBe(
      resolve(process.cwd(), 'apps/api/config/manager.testnet.yaml')
    );
  });
});
