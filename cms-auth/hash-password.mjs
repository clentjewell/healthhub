/**
 * Generate an AUTH_USERS line for the CMS login worker.
 *
 *   node cms-auth/hash-password.mjs editor@example.com
 *
 * It asks for a password (input is hidden), then prints one line:
 *   editor@example.com:pbkdf2$sha256$210000$<salt>$<hash>
 *
 * Add that line to the worker's AUTH_USERS secret (one editor per line).
 * The password itself is never stored — only this one-way hash.
 *
 * Must stay in sync with verifyPbkdf2() in src/index.js: PBKDF2-SHA256,
 * 210000 iterations, 16-byte salt, 32-byte derived key, standard base64.
 */
import { pbkdf2, randomBytes } from 'node:crypto';

const ITERATIONS = 100000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Usage: node cms-auth/hash-password.mjs <editor-email>');
  process.exit(1);
}

const password = await readHidden(`Password for ${email}: `);
if (!password || password.length < 10) {
  console.error('\nPassword must be at least 10 characters. Nothing written.');
  process.exit(1);
}

const salt = randomBytes(SALT_BYTES);
pbkdf2(password, salt, ITERATIONS, KEY_BYTES, 'sha256', (err, key) => {
  if (err) throw err;
  const line = `${email}:pbkdf2$sha256$${ITERATIONS}$${salt.toString('base64')}$${key.toString('base64')}`;
  console.log('\n\nAdd this line to the AUTH_USERS secret:\n');
  console.log(line);
  console.log('');
});

/** Read a line from the terminal without echoing keystrokes. */
function readHidden(prompt) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(prompt);
    const raw = stdin.isTTY;
    if (raw) stdin.setRawMode(true);
    stdin.resume();
    let buf = '';
    const onData = (chunk) => {
      const s = chunk.toString('utf8');
      for (const ch of s) {
        if (ch === '\n' || ch === '\r' || ch === '') {
          if (raw) stdin.setRawMode(false);
          stdin.removeListener('data', onData);
          stdin.pause();
          stdout.write('\n');
          return resolve(buf);
        } else if (ch === '') { // Ctrl-C
          process.exit(1);
        } else if (ch === '' || ch === '\b') { // backspace
          buf = buf.slice(0, -1);
        } else {
          buf += ch;
        }
      }
    };
    stdin.on('data', onData);
  });
}
