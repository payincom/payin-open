const fs = require('fs');
const path = require('path');

const dependencies = {
  'processor': ['shared', 'monitor'],
  'manager': ['shared', 'notification', 'processor'],
  'auth': ['shared', 'email'],
  'notification': ['shared'],
  'email': ['shared'],
  'test-utils': ['shared', 'processor', 'auth', 'manager']
};

for (const [pkg, deps] of Object.entries(dependencies)) {
  const tsconfig = path.join(__dirname, '..', 'packages', pkg, 'tsconfig.json');
  if (fs.existsSync(tsconfig)) {
    const config = JSON.parse(fs.readFileSync(tsconfig, 'utf8'));
    config.references = deps.map(dep => ({ path: `../${dep}` }));
    fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2) + '\n');
    console.log(`✅ Added references to ${pkg}: ${deps.join(', ')}`);
  }
}

console.log('\n✅ All references added!');
