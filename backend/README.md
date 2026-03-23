# SaaS Backend

NestJS backend with PostgreSQL, Prisma ORM, and JWT authentication.

## Prerequisites

- Node.js >= 18
- PostgreSQL running locally or remotely

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables and configure them
cp .env.example .env
# Edit .env with your DATABASE_URL and a strong JWT_SECRET

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Start in development mode
npm run start:dev
```

## API Endpoints

All endpoints are prefixed with `/api`.

### Auth

| Method | Endpoint       | Description      | Auth |
|--------|----------------|------------------|------|
| POST   | /api/auth/signup | Register a user  | No   |
| POST   | /api/auth/login  | Login            | No   |

### Users

| Method | Endpoint       | Description          | Auth |
|--------|----------------|----------------------|------|
| GET    | /api/users/me  | Get current profile  | Yes  |
| PATCH  | /api/users/me  | Update profile       | Yes  |
| DELETE | /api/users/me  | Delete account       | Yes  |
| GET    | /api/users/:id | Get user by ID       | Yes  |

## Project Structure

```
src/
├── common/
│   ├── decorators/      # Custom decorators (@CurrentUser)
│   ├── filters/         # Exception filters (AllExceptionsFilter)
│   └── guards/          # Auth guards (JwtAuthGuard)
├── config/              # Environment validation
├── modules/
│   ├── auth/            # Authentication (login, signup, JWT)
│   │   ├── dto/
│   │   └── strategies/
│   └── users/           # User CRUD
│       └── dto/
├── prisma/              # PrismaService & PrismaModule
├── app.module.ts
└── main.ts
```

## Scripts

```bash
npm run build         # Production build
npm run start         # Start production server
npm run start:dev     # Start with hot reload
npm run start:debug   # Start with debugger
npm run lint          # Lint code
npm run test          # Run unit tests
```
