# Netlify Deployment Guide

This guide will help you deploy the Attendance Tracker application to Netlify with a PostgreSQL database.

## Prerequisites

1. **Netlify Account**: Sign up at [netlify.com](https://netlify.com)
2. **PostgreSQL Database**: You'll need a cloud PostgreSQL database. Recommended providers:
   - [Supabase](https://supabase.com) (Free tier available)
   - [Railway](https://railway.app) (Free tier available)
   - [Neon](https://neon.tech) (Free tier available)
   - [PlanetScale](https://planetscale.com) (MySQL alternative)

## Step 1: Set Up PostgreSQL Database

### Option A: Using Supabase (Recommended)
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be provisioned
3. Go to Settings > Database
4. Copy the connection string (it looks like: `postgresql://postgres:[password]@[host]:5432/postgres`)

### Option B: Using Railway
1. Go to [railway.app](https://railway.app) and create a new project
2. Add a PostgreSQL service
3. Go to the PostgreSQL service and copy the connection string from the "Connect" tab

### Option C: Using Neon
1. Go to [neon.tech](https://neon.tech) and create a new project
2. Copy the connection string from the dashboard

## Step 2: Deploy to Netlify

### Method 1: Connect GitHub Repository (Recommended)
1. Push your code to a GitHub repository
2. Go to [netlify.com](https://netlify.com) and click "New site from Git"
3. Connect your GitHub account and select your repository
4. Netlify will automatically detect the build settings from `netlify.toml`

### Method 2: Manual Deploy
1. Run `npm run netlify:build` locally
2. Drag and drop the `build` folder to Netlify's deploy area

## Step 3: Configure Environment Variables

In your Netlify site dashboard, go to Site settings > Environment variables and add:

### Required Variables:
```
DATABASE_PROVIDER=postgresql
DATABASE_URL=your_postgresql_connection_string_here
JWT_SECRET=your-secure-jwt-secret-here
SESSION_SECRET=your-secure-session-secret-here
NODE_ENV=production
```

### Example Values:
```
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://postgres:password@db.example.com:5432/attendance_tracker
JWT_SECRET=your-super-secure-jwt-secret-change-this-in-production
SESSION_SECRET=your-super-secure-session-secret-change-this-in-production
NODE_ENV=production
```

## Step 4: Initialize Database

After deployment, you need to set up your database schema:

### Option A: Using Netlify CLI (Recommended)
1. Install Netlify CLI: `npm install -g netlify-cli`
2. Login: `netlify login`
3. Link your site: `netlify link`
4. Run database migration: `netlify dev --command "npm run db:push:prod"`
5. Create a production seed script or manually insert initial data

### Option B: Using Database Client
1. Connect to your PostgreSQL database using a client like pgAdmin or TablePlus
2. Use Prisma to push the schema: `npx prisma db push --schema=prisma/schema.production.prisma`
3. Insert initial superadmin data:
   ```sql
   INSERT INTO "superadmins" (id, email, password, name, "superadminVerifyCode")
   VALUES (
     'superadmin1',
     'superadmin@example.com',
     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
     'Super Admin',
     'SUPER2024'
   );
   ```

## Step 5: Test Your Deployment

1. Visit your Netlify site URL
2. Try logging in with the default superadmin credentials:
   - Email: `superadmin@example.com`
   - Password: `superadmin123`
3. Test the attendance tracking functionality
4. Test Excel export with IMAGE formulas

## Troubleshooting

### Common Issues:

1. **Database Connection Error**
   - Verify your `DATABASE_URL` is correct
   - Ensure your database allows connections from Netlify's IP ranges
   - Check that `DATABASE_PROVIDER` is set to `postgresql`

2. **Build Failures**
   - Check the build logs in Netlify dashboard
   - Ensure all dependencies are in `package.json`
   - Verify Node.js version compatibility

3. **Function Timeout**
   - Netlify functions have a 10-second timeout on free plans
   - Consider upgrading to Pro plan for longer timeouts
   - Optimize database queries for better performance

4. **Static Assets Not Loading**
   - Check that the `publish` directory in `netlify.toml` is correct
   - Verify asset paths in your application

### Environment Variables Not Working:
- Make sure variable names match exactly (case-sensitive)
- Redeploy after adding new environment variables
- Check for typos in variable names

### Database Schema Issues:
- Run `npx prisma db push` to sync schema changes
- Check Prisma logs for migration errors
- Ensure database user has proper permissions

## Security Considerations

1. **Change Default Credentials**: Immediately change the default superadmin password
2. **Secure Secrets**: Use strong, unique values for `JWT_SECRET` and `SESSION_SECRET`
3. **Database Security**: Enable SSL connections and restrict database access
4. **Environment Variables**: Never commit secrets to your repository

## Performance Optimization

1. **Database Indexing**: Add indexes for frequently queried fields
2. **Image Optimization**: Consider using a CDN for photo storage
3. **Caching**: Implement appropriate caching strategies
4. **Bundle Size**: Monitor and optimize JavaScript bundle size

## Monitoring and Maintenance

1. **Logs**: Monitor Netlify function logs for errors
2. **Database**: Monitor database performance and storage usage
3. **Backups**: Set up regular database backups
4. **Updates**: Keep dependencies updated for security

## Support

If you encounter issues:
1. Check Netlify's build logs
2. Review database connection logs
3. Test locally with production environment variables
4. Consult Netlify and database provider documentation

---

**Note**: This deployment uses serverless functions, which means the application will "cold start" after periods of inactivity. The first request after inactivity may take a few seconds longer to respond.