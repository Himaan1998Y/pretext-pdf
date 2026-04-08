# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | Yes                |
| < 0.3   | No                 |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email **himanshu@antigravity.dev** with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

You will receive a response within **48 hours**. If the issue is confirmed, we will:

1. Acknowledge the report
2. Release a patch as soon as possible
3. Credit you in the CHANGELOG (unless you prefer anonymity)

## Scope

This library generates PDF files from user-provided JSON data. Security considerations include:

- **PDF injection**: Malicious content in `text` fields that could exploit PDF viewer vulnerabilities
- **Path traversal**: Malicious paths in `src` fields for fonts or images
- **Resource exhaustion**: Extremely large documents consuming excessive memory

We take all reports seriously. Thank you for helping keep pretext-pdf secure.
