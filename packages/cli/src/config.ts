import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { CliConfig, CliProfile } from './types.js';

export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.PAYIN_CONFIG) return env.PAYIN_CONFIG;
  const base = env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'payin', 'config.json');
}

export function emptyConfig(): CliConfig {
  return { profiles: {} };
}

export function loadConfig(path = configPath()): CliConfig {
  if (!existsSync(path)) return emptyConfig();
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<CliConfig>;
  return { currentProfile: parsed.currentProfile, profiles: parsed.profiles || {} };
}

export function saveConfig(config: CliConfig, path = configPath()): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

export function upsertProfile(profile: CliProfile, path = configPath()): CliConfig {
  const config = loadConfig(path);
  config.profiles[profile.name] = profile;
  config.currentProfile ||= profile.name;
  saveConfig(config, path);
  return config;
}

export function useProfile(name: string, path = configPath()): CliConfig {
  const config = loadConfig(path);
  if (!config.profiles[name]) throw new Error(`Profile not found: ${name}`);
  config.currentProfile = name;
  saveConfig(config, path);
  return config;
}

export function removeProfile(name: string, path = configPath()): CliConfig {
  const config = loadConfig(path);
  delete config.profiles[name];
  if (config.currentProfile === name) {
    const nextProfile = Object.keys(config.profiles)[0];
    if (nextProfile) config.currentProfile = nextProfile;
    else delete config.currentProfile;
  }
  saveConfig(config, path);
  return config;
}

export function redactProfile(profile: CliProfile): CliProfile {
  const redacted: CliProfile = { ...profile };
  if (profile.token) redacted.token = redactSecret(profile.token);
  else delete redacted.token;
  if (profile.apiKey) redacted.apiKey = redactSecret(profile.apiKey);
  else delete redacted.apiKey;
  return redacted;
}

export function redactSecret(value: string): string {
  if (value.length <= 10) return '***';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
