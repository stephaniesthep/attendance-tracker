# Netlify Deployment Guide

## Issue Resolution: Database Connection Error

### Problem
The application was failing on Netlify with the error:
```
PrismaClientInitializationError: Can't reach database server at `aws-0-ap-southeast-1.pooler.supabase.com:5432`
```

### Root Cause
Netlify deployments don't have access to local `.env` files, so the `DATABASE_URL` and other environment variables were not available in production.

### Solutions Implemented

#### 1. Environment Variables in netlify.toml
Added environment variables directly to [`netlify.toml`](../../netlify.toml:1):

```toml
[context.production.environment]
DATABASE_URL = "postgresql://postgres.ldqsrxeobvcqwkyltzwf:lQ4uG9CZgcGmHJBi@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
JWT_SECRET = "your-secret-key-here-change-in-production"
SESSION_SECRET = "your-session-secret-here-change-in-production"
```

#### 2. Enhanced Build Process
Updated the build command to ensure Prisma client is generated:
```toml
[build]
command = "npm ci && npx prisma generate && npm run build"
```

#### 3. Improved Database Connection
Enhanced [`app/utils/db.server.ts`](../../app/utils/db.server.ts:1) with:
- Explicit database URL configuration
- Better error handling
- Connection logging
- Production-specific optimizations

## Alternative Solution: Netlify Dashboard

Instead of hardcoding environment variables in `netlify.toml`, you can configure them in the Netlify dashboard:

1. Go to your Netlify dashboard
2. Select your site
3. Navigate to **Site settings** → **Environment variables**
4. Add the following variables:
   - `DATABASE_URL`: Your Supabase connection string
   - `JWT_SECRET`: Your JWT secret key
   - `SESSION_SECRET`: Your session secret key

## Security Considerations

⚠️ **Important**: The current implementation has environment variables in `netlify.toml`, which may be committed to version control. For better security:

1. Use the Netlify dashboard method instead
2. Or use Netlify's encrypted environment variables
3. Rotate secrets regularly
4. Use different secrets for production vs development

## Deployment Checklist

Before deploying to Netlify:

- [ ] Database is accessible from Netlify's servers
- [ ] Environment variables are configured
- [ ] Prisma schema is up to date
- [ ] Database migrations are applied
- [ ] Build process includes `prisma generate`

## Troubleshooting

### Common Issues

1. **Database Connection Timeout**
   - Check if Supabase database is running
   - Verify connection string format
   - Ensure database allows connections from Netlify IPs

2. **Prisma Client Not Generated**
   - Ensure `prisma generate` runs during build
   - Check if `@prisma/client` is in dependencies (not devDependencies)

3. **Environment Variables Not Available**
   - Verify variables are set in Netlify dashboard or `netlify.toml`
   - Check variable names match exactly
   - Ensure no typos in connection strings

### Debugging Steps

1. Check Netlify build logs for errors
2. Verify environment variables in Netlify dashboard
3. Test database connection locally with production credentials
4. Check Prisma client generation in build logs

## Next Steps

1. Test the deployment after implementing these changes
2. Monitor application logs for any remaining issues
3. Consider implementing database connection pooling for better performance
4. Set up monitoring and alerting for database connectivity issues