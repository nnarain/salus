# Contributing to Health Tracker

Thank you for your interest in contributing to Health Tracker! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites
- Node.js 20+
- Docker and Docker Compose
- VSCode (recommended)

### Quick Start with Dev Container (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/nnarain/health-tracker.git
   cd health-tracker
   ```

2. Open in VSCode and install the "Remote - Containers" extension

3. Click "Reopen in Container" when prompted

4. The dev environment will automatically set up with all dependencies

### Manual Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/nnarain/health-tracker.git
   cd health-tracker
   ```

2. Set up environment variables:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. Start the development database:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d postgres
   ```

4. Install and run backend:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

5. Install and run frontend (in another terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Project Structure

```
health-tracker/
├── backend/              # Express backend API
│   ├── src/
│   │   ├── config/      # Configuration files
│   │   ├── controllers/ # Route controllers
│   │   ├── middleware/  # Express middleware
│   │   ├── routes/      # API routes
│   │   └── services/    # Business logic & external services
├── frontend/            # React frontend
│   └── src/
│       ├── components/  # React components
│       ├── services/    # API client
│       └── types/       # TypeScript types
└── .devcontainer/       # VSCode dev container config
```

## Code Style

### TypeScript
- Use TypeScript for all new code
- Enable strict mode
- Define proper types/interfaces
- Avoid `any` type unless absolutely necessary

### React
- Use functional components with hooks
- Follow React best practices
- Use proper component naming (PascalCase)
- Keep components focused and single-purpose

### Styling
- Use Tailwind CSS utility classes
- Follow existing styling patterns
- Keep responsive design in mind

## Making Changes

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Messages
- Use clear, descriptive commit messages
- Start with a verb (Add, Fix, Update, Remove, etc.)
- Keep the first line under 72 characters
- Add detailed description if needed

Example:
```
Add calorie tracking feature

- Implement meal logging with nutritional info
- Add daily calorie statistics endpoint
- Create calorie chart component
```

## Testing

### Backend
```bash
cd backend
npm test
```

### Frontend
```bash
cd frontend
npm test
```

## Building

### Backend
```bash
cd backend
npm run build
```

### Frontend
```bash
cd frontend
npm run build
```

## Docker

### Build Docker images
```bash
docker-compose build
```

### Run with Docker
```bash
docker-compose up -d
```

## Adding New Features

### Backend API Endpoint

1. Create controller in `backend/src/controllers/`
2. Define route in `backend/src/routes/`
3. Add rate limiting if needed
4. Update types if needed
5. Test the endpoint

### Frontend Component

1. Create component in `frontend/src/components/`
2. Define TypeScript types in `frontend/src/types/`
3. Add API calls in `frontend/src/services/api.ts`
4. Integrate with existing UI
5. Test the component

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test your changes thoroughly
5. Update documentation if needed
6. Submit a pull request with clear description

### PR Checklist
- [ ] Code follows project style guidelines
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No console errors or warnings
- [ ] Changes work in Docker environment
- [ ] Security considerations addressed

## Security

- Never commit sensitive data (API keys, passwords)
- Use environment variables for configuration
- Follow security best practices
- Report security issues privately

## Code Review

All submissions require review. We use GitHub pull requests for this purpose.

## Questions?

Feel free to open an issue for:
- Bug reports
- Feature requests
- Questions about the codebase
- Documentation improvements

## License

By contributing, you agree that your contributions will be licensed under the ISC License.
