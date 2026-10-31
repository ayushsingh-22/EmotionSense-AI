# Storage service

The backend uses Prisma with Neon PostgreSQL. Set `DATABASE_URL` to the pooled application connection and `DIRECT_URL` to the matching direct connection for migrations and the nightly journal lock. See `docs/DEPLOYMENT_ENV.md` at the repository root for deployment configuration.

The storage functions in `index.js` handle user-scoped records, including chats, summaries, alerts and activity. Authentication and ownership checks are enforced by the backend routes and middleware.
