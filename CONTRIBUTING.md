# Contributing to AI Virtual Receptionist

Thank you for your interest in contributing! This document provides guidelines and workflows for contributing to this project.

## 🌳 Branching Strategy

We use a simplified Git Flow:

- `main` - Production-ready code, protected branch
- `develop` - Integration branch for features (optional)
- `feature/*` - New features
- `fix/*` - Bug fixes
- `refactor/*` - Code refactoring
- `docs/*` - Documentation updates

## 📝 Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `style`: Code style changes (formatting, etc.)

### Examples:

```bash
feat(api): Add appointment rescheduling endpoint

Implements POST /api/appointments/:id/reschedule with
timezone awareness and email notifications.

Closes #123
```

```bash
fix(scheduler): Use business timezone for upcoming count

Previously used server timezone which gave incorrect
results for clients in different timezones.
```

```bash
refactor(di): Implement dependency injection in services

- ReceptionistService accepts injected dependencies
- SchedulerService accepts injected dependencies
- All changes are backwards compatible
```

## 🔄 Development Workflow

### 1. Create a Feature Branch

```bash
# Update main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Write clean, maintainable code
- Follow existing code style
- Add/update tests as needed
- Update documentation

### 3. Commit Your Changes

```bash
# Stage changes
git add .

# Commit with conventional format
git commit -m "feat(scope): Add new feature"
```

### 4. Push and Create PR

```bash
# Push to remote
git push -u origin feature/your-feature-name

# Go to GitHub and create Pull Request
```

### 5. Code Review

- Address review comments
- Update PR as needed
- All CI checks must pass
- At least 1 approval required

### 6. Merge

- Squash and merge for clean history
- Delete feature branch after merge

## ✅ Pre-commit Checklist

Before committing, ensure:

- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] No console.log() statements
- [ ] No magic numbers (use constants)
- [ ] Proper error handling
- [ ] Comments for complex logic
- [ ] TypeScript types are correct
- [ ] No linter warnings

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test
```

### Frontend Tests

```bash
cd frontend
npm test
```

### Run All Tests

```bash
# From root directory
npm test --prefix backend
npm test --prefix frontend
```

## 🏗️ Building

### Backend Build

```bash
cd backend
npm run build
```

### Frontend Build

```bash
cd frontend
npm run build
```

## 📋 Code Review Guidelines

### As a Reviewer:

- Check for code quality and maintainability
- Verify tests cover new functionality
- Look for security issues
- Ensure documentation is updated
- Be constructive and respectful

### As an Author:

- Respond to all comments
- Explain your decisions
- Update code based on feedback
- Keep PR scope focused

## 🔒 Security

- Never commit secrets or API keys
- Use environment variables
- Validate all user inputs
- Follow OWASP guidelines
- Report security issues privately

## 📚 Documentation

- Update README.md for feature changes
- Add JSDoc comments for functions
- Update API documentation
- Include examples where helpful

## ❓ Questions?

If you have questions:
1. Check existing documentation
2. Search closed issues
3. Open a new issue for discussion

## 🎯 Best Practices

### Code Style

- Use meaningful variable names
- Keep functions small and focused
- Extract constants for magic numbers
- Follow DRY (Don't Repeat Yourself)
- Use dependency injection

### Git Practices

- Keep commits atomic and focused
- Write clear commit messages
- Rebase before creating PR
- Keep PR scope reasonable
- Reference issues in commits

### Testing

- Write tests for new features
- Test edge cases
- Mock external dependencies
- Aim for meaningful coverage

## 🚀 Deployment

Deployments are automatic after merge to `main`:

- Frontend → Vercel
- Backend → Railway

Ensure all checks pass before merging!

## 📞 Contact

For questions or help:
- Open an issue
- Email: [your-email]
- Discord: [your-discord] (if applicable)

---

**Thank you for contributing!** 🎉
