import { loadRootEnv } from '@payin/shared';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import YAML from 'yaml';
import { Processor } from '../src/processor.js';

async function main() {
  loadRootEnv(['.env'], { rootDir: resolve(__dirname, '..') });

  const configFile = process.argv[2];
  const config = configFile ? YAML.parse(readFileSync(configFile, 'utf-8')) : {};

  const processor = await Processor.create(config);
  await processor.start();
  console.log('Processor started. Press Ctrl+C to exit.');
}

main().catch((error) => {
  console.error('Failed to start processor:', error);
  process.exit(1);
});
