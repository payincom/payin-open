#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const ignoredDirs = new Set(['.git', 'node_modules', 'dist', '.vitepress/cache', '.vitepress/dist']);
const textExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.json', '.md', '.yml', '.yaml', '.toml', '.env', '.example', '.sh', '.txt'
]);

const rules = [
  {
    id: 'no-private-railway-project-id',
    pattern: /railway\.com\/project\/(?!<RAILWAY_PROJECT_ID>)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|environmentId=(?!<RAILWAY_[A-Z_]+_ENVIRONMENT_ID>)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    message: 'Open must not contain PayIn Cloud private Railway project/environment IDs.',
  },
  {
    id: 'no-payin-cloud-runtime-domain',
    pattern: /https?:\/\/(api\.)?(sandbox\.)?payin\.com(\/api\/v1)?/g,
    message: 'Open runtime templates must use self-hosting placeholder domains, not PayIn Cloud hosted domains.',
    allow: [
      /^README\.md$/,
      /^docs\/architecture\/open-vs-cloud\.md$/,
      /^docs\/self-hosting\/README\.md$/,
      /^apps\/docs\//,
      /^skills\/payin-open\/SKILL\.md$/,
    ],
  },
  {
    id: 'no-payin-go-internals',
    pattern: /PAYIN_GO_DESIGN|PayInGo|payingo|payin-go internal/gi,
    message: 'PayIn Go internal material must not be published in PayIn Open.',
  },
  {
    id: 'no-payin-cloud-repo-runtime-ref',
    pattern: /payincom\/payin-cloud|payin-cloud\.git/g,
    message: 'Open runtime/docs should not depend on the private PayIn Cloud repository.',
    allow: [/^docs\/architecture\/open-vs-cloud\.md$/],
  },
  {
    id: 'no-cloud-layer-implementation-in-open',
    pattern: /\bCloudProcessor\b|\bCloudManager\b|src\/cloud\//g,
    message: 'Cloud overlay implementations belong in payin-cloud-layer, not PayIn Open.',
    allow: [/^docs\//],
    include: [/^(apps|packages|skills)\//],
  },
];

function shouldSkipDir(name) {
  return ignoredDirs.has(name);
}

function isTextFile(file) {
  const base = path.basename(file);
  if (base === '.env.example') return true;
  const ext = path.extname(file);
  return textExtensions.has(ext);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) walk(path.join(dir, entry.name), out);
    } else if (entry.isFile()) {
      const file = path.join(dir, entry.name);
      if (isTextFile(file)) out.push(file);
    }
  }
  return out;
}

const findings = [];
const forbiddenPaths = [
  {
    rel: 'apps/admin',
    message: 'PayIn Open is headless/Agent-operated and must not ship the inherited admin UI.',
  },
  {
    rel: 'Dockerfile.admin',
    message: 'PayIn Open must not ship admin UI deployment artifacts.',
  },
  {
    rel: 'railway.production.admin.toml',
    message: 'PayIn Open must not ship admin UI deployment artifacts.',
  },
  {
    rel: 'railway.test.admin.toml',
    message: 'PayIn Open must not ship admin UI deployment artifacts.',
  },
  {
    rel: 'scripts/deployment/deploy-admin-to-railway.sh',
    message: 'PayIn Open must not ship admin UI deployment artifacts.',
  },
];

for (const item of forbiddenPaths) {
  if (fs.existsSync(path.join(root, item.rel))) {
    findings.push({ rule: 'no-open-admin-ui', file: item.rel, line: 1, value: item.rel, message: item.message });
  }
}

for (const file of walk(root)) {
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  const text = fs.readFileSync(file, 'utf8');
  if (rel === 'scripts/quality/check-open-boundary.cjs') continue;
  for (const rule of rules) {
    if (rule.include && !rule.include.some((rx) => rx.test(rel))) continue;
    if (rule.allow?.some((rx) => rx.test(rel))) continue;
    const matches = [...text.matchAll(rule.pattern)];
    for (const match of matches) {
      const before = text.slice(0, match.index);
      const line = before.split('\n').length;
      findings.push({ rule: rule.id, file: rel, line, value: match[0], message: rule.message });
    }
  }
}

if (findings.length) {
  console.error('PayIn Open boundary check failed:');
  for (const item of findings) {
    console.error(`- [${item.rule}] ${item.file}:${item.line}: ${item.value}`);
    console.error(`  ${item.message}`);
  }
  process.exit(1);
}

console.log('PayIn Open boundary check passed.');
