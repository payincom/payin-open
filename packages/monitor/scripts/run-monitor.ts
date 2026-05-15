import { loadRootEnv } from '@payin/shared';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import YAML from 'yaml';
import { Monitor } from '../src/monitor/monitor.js';

async function main() {
  loadRootEnv(['.env'], { rootDir: resolve(__dirname, '..') });

  const configPath = process.argv[2] || resolve(__dirname, '../config/default-monitor.yaml');
  const configContent = readFileSync(configPath, 'utf-8');
  const rawConfig = YAML.parse(configContent);

  const monitor = new Monitor(rawConfig);
  await monitor.start();
}

main().catch((error) => {
  console.error('Failed to start monitor script:', error);
  process.exit(1);
});
