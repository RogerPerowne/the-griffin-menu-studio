const fs = require('node:fs');

const certificateFile = process.env.WINDOWS_CERTIFICATE_FILE;
const certificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;

if (!certificateFile || !certificatePassword) {
  console.error('A signed release requires WINDOWS_CERTIFICATE_FILE and WINDOWS_CERTIFICATE_PASSWORD.');
  console.error('See .env.signing.example and docs/windows-release-process.md.');
  process.exit(1);
}

try {
  fs.accessSync(certificateFile, fs.constants.R_OK);
} catch {
  console.error('WINDOWS_CERTIFICATE_FILE does not point to a readable PFX file.');
  process.exit(1);
}
