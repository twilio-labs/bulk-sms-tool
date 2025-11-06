# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within this SMS Bulk Sender application, please send an email to the maintainers. All security vulnerabilities will be promptly addressed.

**Please do not report security vulnerabilities through public GitHub issues.**

## Security Considerations

This application handles:
- Twilio API credentials
- Phone numbers
- SMS messages

### Best Practices:
1. **Never commit `.env` files** - They contain sensitive Twilio credentials
2. **Use environment variables** for all sensitive configuration
3. **Keep dependencies updated** - Run `npm audit` regularly
4. **Rate limiting is enabled** - But monitor for abuse
5. **Validate all inputs** - Phone numbers and message content
6. **Use HTTPS in production** - Never send credentials over HTTP

### Environment Variables Security:
- `TWILIO_ACCOUNT_SID` - Keep private
- `TWILIO_AUTH_TOKEN` - Keep private and rotate regularly
- `TWILIO_PHONE_NUMBER` - Can be public but keep secure

Thank you for helping keep SMS Bulk Sender secure!
