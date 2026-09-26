#!/usr/bin/env node
/* Generates a bcrypt hash for ADMIN_PASSWORD_HASH.
   The plaintext password never needs to sit in an environment
   variable — only this hash does. Run once, paste the output. */
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Choose an admin password (input will be visible): ', (pw) => {
  if (!pw || pw.length < 8) {
    console.error('\nUse at least 8 characters — this protects your entire admin panel.');
    process.exit(1);
  }
  const hash = bcrypt.hashSync(pw, 12);
  console.log('\nAdd this line to your .env (or your host\'s environment variables):\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
  console.log('The plaintext password above is not stored anywhere — only this hash.');
  rl.close();
});
