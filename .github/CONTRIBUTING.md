# Contributing to SMS Bulk Sender

Thank you for your interest in contributing to SMS Bulk Sender! 🎉

## How to Contribute

### Reporting Bugs
- Use the GitHub issue tracker
- Describe the bug clearly with steps to reproduce
- Include environment information (Node.js version, OS, etc.)

### Suggesting Features
- Open an issue with the "feature request" label
- Describe the feature and why it would be useful
- Include mockups or examples if applicable

### Code Contributions

#### Setup Development Environment
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/bulk_sms.git`
3. Install dependencies: `npm run install:all`
4. Start backend: `npm run dev:backend` (in one terminal)
5. Start frontend: `npm run dev` (in another terminal)
6. Configure Twilio credentials in the app interface

#### Development Guidelines
- Use meaningful commit messages
- Follow the existing code style
- Test your changes thoroughly
- Update documentation if needed

#### Pull Request Process
1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Test everything works
4. Commit: `git commit -m "Add your feature"`
5. Push: `git push origin feature/your-feature-name`
6. Open a pull request

## Code Style

### Frontend (React)
- Use functional components with hooks
- Follow React best practices
- Use Tailwind CSS for styling
- Keep components small and focused

### Backend (Node.js)
- Use ES modules (import/export)
- Follow RESTful API conventions
- Add proper error handling
- Include input validation

## Testing
- Test with real phone numbers (use your own for safety)
- Test CSV upload with various formats
- Test error scenarios
- Test rate limiting

## Questions?
Feel free to open an issue for any questions about contributing!

Thank you for contributing! 🚀
