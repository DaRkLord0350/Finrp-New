#!/usr/bin/env node
const { execSync } = require('child_process');

try {
  console.log('Regenerating Prisma client...');
  execSync('npx prisma generate', {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  console.log('✓ Prisma client regenerated successfully');
  process.exit(0);
} catch (error) {
  console.error('✗ Failed to regenerate Prisma client:', error.message);
  process.exit(1);
}
