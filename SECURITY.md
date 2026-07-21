# Security Policy

If you discover a security vulnerability please email gagemichaeldev@gmail.com with a detailed report.

Responsible disclosure:

- Please include steps to reproduce, affected versions, and any PoC if available.
- Do not publicly disclose until a fix is available or coordinated disclosure is agreed.

Security practices for this project:

- IPC/commands are restricted to owning windows where applicable.
- Content Security Policy (CSP) is enforced in `src-tauri/tauri.conf.json`.
- Keep dependencies up-to-date and run `npm audit` and `cargo audit` regularly.
- Do not commit secrets; use environment variables and secret management.

# Build & Release

Signed releases are recommended. Provide checksums and signatures alongside release artifacts.
