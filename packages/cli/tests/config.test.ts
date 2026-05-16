import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { loadConfig, redactProfile, removeProfile, upsertProfile, useProfile } from '../src/config.js';

function tempConfig() {
  const dir = mkdtempSync(join(tmpdir(), 'payin-cli-'));
  return { dir, path: join(dir, 'config.json'), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('PayIn CLI profile config', () => {
  it('creates, switches, and removes profiles', () => {
    const temp = tempConfig();
    try {
      upsertProfile({ name: 'open-local', url: 'http://localhost:3000', token: 'jwt_1234567890abcdef' }, temp.path);
      upsertProfile({ name: 'cloud', url: 'https://api.payin.example.com' }, temp.path);
      expect(loadConfig(temp.path).currentProfile).toBe('open-local');
      useProfile('cloud', temp.path);
      expect(loadConfig(temp.path).currentProfile).toBe('cloud');
      removeProfile('cloud', temp.path);
      const config = loadConfig(temp.path);
      expect(config.currentProfile).toBe('open-local');
      expect(config.profiles.cloud).toBeUndefined();
    } finally {
      temp.cleanup();
    }
  });

  it('redacts credentials for output', () => {
    expect(redactProfile({ name: 'p', url: 'u', apiKey: 'pk_test_abcdefghijklmnopqrstuvwxyz' }).apiKey).toBe('pk_tes…wxyz');
  });
});
