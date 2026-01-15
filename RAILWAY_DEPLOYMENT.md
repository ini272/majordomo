# Railway Deployment Guide

This guide will help you deploy Majordomo to Railway for mobile testing.

## Prerequisites

- GitHub account with this repository
- Railway account (sign up at https://railway.app with GitHub)

## Initial Setup (One-time)

### 1. Create Railway Project

1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Select `majordomo` repository
4. Railway will automatically detect the `railway.toml` configuration

### 2. Add PostgreSQL Database

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database" → "Add PostgreSQL"**
3. Railway automatically creates a database and injects `DATABASE_URL` environment variable

### 3. Configure Backend Service

Click on the **backend** service, then go to **"Variables"** tab and add:

```
SECRET_KEY=<generate-a-random-secret>
GROQ_API_KEY=<your-groq-api-key-optional>
CORS_ORIGINS=*
```

**To generate SECRET_KEY:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 4. Configure Frontend Service

Click on the **frontend** service, then go to **"Settings"** tab:

1. Under **"Build"**, add **Build Arguments**:
   ```
   VITE_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}/api
   ```

   This tells the frontend where to find the backend API.

2. Under **"Networking"**, click **"Generate Domain"** to get a public URL

### 5. Generate Backend Domain

Click on the **backend** service → **"Settings"** → **"Networking"** → **"Generate Domain"**

This gives your backend a public URL that the frontend can call.

### 6. Deploy

Railway will automatically deploy both services. Watch the deployment logs to ensure everything works.

**Your app will be available at:**
- Frontend: `https://your-frontend.up.railway.app`
- Backend API: `https://your-backend.up.railway.app/api`

## Automatic PR Preview Deployments

Railway can automatically deploy every PR for testing:

1. In Railway project settings, go to **"Deployments"**
2. Enable **"PR Deploys"**
3. Each PR will get a unique URL like `pr-123-frontend.up.railway.app`

### Testing Workflow

1. Claude creates a PR with new feature
2. Railway auto-deploys to preview URL
3. You test on your phone using the preview URL
4. If approved, merge PR → Auto-deploys to production
5. If changes needed, Claude updates PR → Railway redeploys preview

## Database Migrations

Railway runs Alembic migrations automatically on deploy. To run migrations manually:

1. Click on **backend** service
2. Go to **"Settings" → "Deploy Triggers"**
3. Add migration command (if needed)

Or use Railway CLI:
```bash
railway run alembic upgrade head
```

## Environment Variables Reference

### Backend
- `DATABASE_URL` - Automatically set by PostgreSQL addon
- `SECRET_KEY` - JWT secret (required)
- `GROQ_API_KEY` - For AI quest generation (optional)
- `CORS_ORIGINS` - Set to `*` for development

### Frontend
- `VITE_API_URL` - Backend API URL (set as build arg)

## Monitoring

- **View Logs:** Click on service → "Logs" tab
- **Metrics:** Click on service → "Metrics" tab for CPU/memory usage
- **Health Checks:** Backend includes `/api/health` endpoint

## Costs

Railway offers $5/month free credit which is plenty for testing:
- Hobby plan: $5/month free credit
- Usage-based pricing after free credit
- Typical testing usage: ~$3-4/month (well within free tier)

## Troubleshooting

### Frontend can't connect to backend
- Check `VITE_API_URL` build arg includes `/api` path
- Ensure backend domain is generated and public
- Check CORS settings in backend

### Database connection errors
- Verify PostgreSQL addon is running
- Check `DATABASE_URL` is set in backend variables

### Build failures
- Check deployment logs in Railway dashboard
- Ensure all dependencies are in pyproject.toml / package.json

## Useful Commands

**Railway CLI** (optional, for advanced usage):
```bash
# Install
npm i -g @railway/cli

# Login
railway login

# Link to project
railway link

# View logs
railway logs

# Run commands in Railway environment
railway run python manage.py migrate
```

## Next Steps

After deployment:
1. Test login/signup on your phone
2. Create a quest and complete it
3. Verify XP/rewards system works
4. Test on different networks (WiFi, cellular)

Your Majordomo app is now accessible anywhere! 🎉
