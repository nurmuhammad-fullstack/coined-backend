const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const includeDirs = ['config', 'middleware', 'models', 'routes', 'services', 'scripts'];
const includeFiles = ['server.js', 'bot.js', 'seed.js', 'delete-students.js', 'students.js', 'User.js', 'ecosystem.config.js'];
const excludedFiles = new Set([
  path.join(root, 'services', 'api.js'),
]);

const files = [];

for (const file of includeFiles) {
  const target = path.join(root, file);
  if (fs.existsSync(target)) files.push(target);
}

for (const dir of includeDirs) {
  const fullDir = path.join(root, dir);
  if (!fs.existsSync(fullDir)) continue;

  const stack = [fullDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(resolved);
      } else if (entry.isFile() && resolved.endsWith('.js')) {
        files.push(resolved);
      }
    }
  }
}

const uniqueFiles = [...new Set(files)].sort();

for (const file of uniqueFiles) {
  if (excludedFiles.has(file)) continue;
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Syntax check passed for ${uniqueFiles.length} files.`);
