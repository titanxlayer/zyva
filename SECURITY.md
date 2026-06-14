# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.4.x (latest) | ✅ |
| 0.3.x | ⚠️ Critical fixes only |
| < 0.3.0 | ❌ |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report security issues privately via one of these channels:

- **GitHub Security Advisories** — [Report a vulnerability](https://github.com/titanxlayer/zyva/security/advisories/new) *(preferred)*
- **Telegram** — [@zyvadev](https://t.me/zyvadev)

Include as much detail as possible:

- Description of the vulnerability and its potential impact
- Steps to reproduce
- Affected version(s)
- Any suggested fix or mitigation

You will receive an acknowledgment within **48 hours** and a resolution timeline within **7 days** for critical issues.

## Security Model

ZYVA Cloud IDE is built with the following security properties:

### Inference
- All AI inference runs on **[0G Private Computer](https://pc.0g.ai)** inside a Trusted Execution Environment (TEE). Prompts and responses are not logged by the inference provider.

### Execution isolation
- User code runs in isolated **WebContainer** (browser WASM) or on-demand **E2B sandboxes** — never on a shared server process.
- Every user's workspace is scoped to their own directory (`/workspaces/{userId}/`). Path traversal outside this boundary is rejected server-side.
- Terminal commands go through a policy layer: **allow / approve / deny** before any execution.

### Authentication
- Sessions use **JWT HttpOnly cookies** via NextAuth v5. Tokens are never exposed to client-side JavaScript.
- OAuth tokens (GitHub, Google) are stored server-side in PostgreSQL and never returned to the browser.
- Wallet sign-in uses **EIP-191 personal_sign** (SIWE) — no private keys are sent to the server.

### Secrets
- All secrets live in `.env.local` (gitignored) and are never shipped in client bundles or exposed over HTTP.
- The repository does not contain real API keys, database credentials, or private keys.

### Known limitations (preview)
- Desktop builds are **unsigned**. Windows and macOS will show a first-launch warning. Only install builds from [official releases](https://github.com/titanxlayer/zyva/releases) or [zyva.dev](https://zyva.dev).
- TEE attestation is reported honestly — ZYVA does not claim verified remote attestation until a full quote flow is implemented.

## Scope

In scope:
- Authentication bypass or session hijacking
- Cross-user workspace access (path traversal, insecure direct object reference)
- Remote code execution on the application server
- Credential or secret exposure in the codebase or builds
- XSS in the IDE or docs that could exfiltrate session tokens

Out of scope:
- Vulnerabilities in third-party services (0G, E2B, GitHub, Google)
- Issues in unsigned desktop builds that require physical access
- Social engineering or phishing
- Denial of service against the preview deployment

## Disclosure Policy

We follow **coordinated disclosure**. Once a fix is deployed we will publish a security advisory crediting the reporter (unless they prefer to remain anonymous).
