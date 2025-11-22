# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within **ai-dokkai**, please send an email to the project maintainer. All security vulnerabilities will be promptly addressed.

**Please do NOT open public issues for security vulnerabilities.**

### What to Include

When reporting a vulnerability, please include:

- A description of the vulnerability
- Steps to reproduce the issue
- Possible impact of the vulnerability
- Any potential solutions you've identified (optional)

### Response Time

- You can expect an initial response within 48 hours
- We will keep you informed about the progress of the fix
- Once the vulnerability is fixed, we will publicly disclose it (with credit to you, if desired)

## Security Best Practices for Users

### API Key Safety

This project uses a **BYOK (Bring Your Own Key)** model:

1. **Never commit API keys** to version control
2. **Use environment variables** (`.env.local`) for development
3. **For production deployment**: Users should input their API keys through the UI settings, NOT bundle them in the build
4. **Rotate keys regularly** if you suspect they have been exposed

### Deployment Security

- The application runs entirely in the browser
- API keys entered through the UI are stored in browser localStorage
- Be cautious when using the app on shared or public computers
- Clear browser data (localStorage) after use on untrusted devices

## Known Security Considerations

- **Client-side API keys**: This application requires users to provide their own API keys, which are stored in browser localStorage. This is inherent to the BYOK model.
- **No server-side protection**: Since this is a static site, there is no backend to proxy API requests or hide keys.

Users should be aware of these limitations and use the application accordingly.
