# Deployment Guide: Meeting Summarizer

This guide will help you deploy the Meeting Summarizer application with:
- **Backend**: Azure App Service (Python/FastAPI)
- **Frontend**: Vercel (Next.js)
- **CI/CD**: GitHub Actions

Total deployment time: ~15-20 minutes

---

## Prerequisites

- [x] Azure account (you're logged in)
- [x] Vercel account (you're logged in)
- [x] GitHub repository with this code
- [x] Azure AI Foundry API credentials

---

## Part 1: Deploy Backend to Azure App Service

### Step 1: Create Azure App Service (5 minutes)

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **"Create a resource"** → Search for **"Web App"**
3. Fill in the details:
   - **Subscription**: Your subscription
   - **Resource Group**: Create new or use existing
   - **Name**: `llm-meet-summarizer-backend` (or your preferred name)
   - **Publish**: **Code**
   - **Runtime stack**: **Python 3.11**
   - **Operating System**: **Linux**
   - **Region**: Choose nearest region (e.g., East US 2)
   - **Pricing Plan**:
     - For testing: **Basic B1** (~$13/month)
     - For production: **Standard S1** (~$55/month)
4. Click **"Review + Create"** → **"Create"**
5. Wait for deployment (1-2 minutes)
6. **Copy your app URL**: `https://llm-meet-summarizer-backend.azurewebsites.net`

### Step 2: Configure Backend Startup Command (2 minutes)

1. In your new App Service, go to **Configuration** → **General settings**
2. Set **Startup Command** to:
   ```bash
   bash startup.sh
   ```
3. Click **"Save"** at the top

### Step 3: Add Environment Variables in Azure (3 minutes)

1. Still in **Configuration** → Click **"Application settings"** tab
2. Click **"+ New application setting"** for each variable:

   | Name | Value |
   |------|-------|
   | `AZURE_AI_ENDPOINT` | Your Azure AI endpoint (e.g., `https://xxx.cognitiveservices.azure.com`) |
   | `AZURE_AI_KEY` | Your Azure AI API key |
   | `AZURE_AI_DEPLOYMENT` | Your deployment name (e.g., `gpt-5-nano`) |
   | `AZURE_AI_API_VERSION` | `2024-05-01-preview` |

3. Click **"Save"** at the top
4. Click **"Continue"** when prompted (this will restart the app)

### Step 4: Download Publish Profile (1 minute)

1. Go back to your App Service **Overview** page
2. Click **"Get publish profile"** at the top
3. Save the downloaded `.PublishSettings` file
4. Open the file in a text editor and **copy all the XML content**

---

## Part 2: Setup GitHub Actions for Auto-Deployment

### Step 5: Add GitHub Secrets (2 minutes)

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** for each:

   | Name | Value |
   |------|-------|
   | `AZURE_WEBAPP_NAME` | `llm-meet-summarizer-backend` (your app name) |
   | `AZURE_WEBAPP_PUBLISH_PROFILE` | Paste the entire XML content from Step 4 |

4. Click **"Add secret"**

### Step 6: Trigger First Deployment (1 minute)

1. Make a small change to any file in the `backend/` folder (or just push your current changes)
2. Commit and push to `main` branch:
   ```bash
   git add .
   git commit -m "Configure deployment"
   git push origin main
   ```
3. Go to **Actions** tab in GitHub to watch the deployment
4. Wait for the green checkmark (2-3 minutes)

### Step 7: Test Backend Deployment (1 minute)

1. Open your browser and visit:
   ```
   https://llm-meet-summarizer-backend.azurewebsites.net/health
   ```
2. You should see:
   ```json
   {
     "status": "healthy",
     "azure_ai_configured": true,
     "azure_ai_endpoint": "https://...",
     "azure_ai_deployment": "gpt-5-nano"
   }
   ```
3. ✅ **Backend is live!**

---

## Part 3: Deploy Frontend to Vercel

### Step 8: Import Project to Vercel (3 minutes)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository:
   - Select your repository
   - Click **"Import"**
4. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)

### Step 9: Add Frontend Environment Variable (1 minute)

1. In the **"Configure Project"** section, expand **"Environment Variables"**
2. Add:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://llm-meet-summarizer-backend.azurewebsites.net` (your backend URL from Step 1)
3. Click **"Deploy"**
4. Wait for deployment (2-3 minutes)
5. **Copy your Vercel URL**: `https://your-project.vercel.app`

### Step 10: Update Backend CORS for Production (2 minutes)

1. Open `backend/main.py` in your code
2. Find the CORS configuration section (around line 26)
3. Uncomment and update the Vercel URL:
   ```python
   allowed_origins = [
       "http://localhost:3000",
       "http://localhost:3001",
       "https://your-project.vercel.app",  # Add your actual Vercel URL here
   ]
   ```
4. Commit and push:
   ```bash
   git add backend/main.py
   git commit -m "Add production CORS origin"
   git push origin main
   ```
5. Wait for GitHub Actions to redeploy (2 minutes)

---

## Part 4: Final Testing

### Step 11: Test Full Application (2 minutes)

1. Open your Vercel URL: `https://your-project.vercel.app`
2. Upload a sample `.vtt` transcript file
3. Verify you see:
   - ✅ Meeting details
   - ✅ Overview summary
   - ✅ Action items
   - ✅ Achievements
   - ✅ Blockers
   - ✅ Chapters
   - ✅ Interactive mindmap
   - ✅ PDF download works

---

## 🎉 Deployment Complete!

Your application is now live at:
- **Frontend**: `https://your-project.vercel.app`
- **Backend**: `https://llm-meet-summarizer-backend.azurewebsites.net`

Share the frontend URL with your manager!

---

## Ongoing Deployment

### Auto-Deployment is Configured!

**Backend**: Every push to `main` branch that changes files in `backend/` will automatically deploy to Azure via GitHub Actions.

**Frontend**: Every push to `main` branch will automatically deploy to Vercel.

No manual deployment needed! Just push your code.

---

## Troubleshooting

### Backend Issues

**Health check shows `azure_ai_configured: false`**
- Check environment variables in Azure Portal → Configuration
- Ensure all 4 Azure AI variables are set correctly

**500 errors when uploading file**
- Check logs: Azure Portal → App Service → Log stream
- Verify Azure AI credentials are valid

**Deployment fails in GitHub Actions**
- Check the Actions tab for error messages
- Verify GitHub secrets are set correctly

### Frontend Issues

**"Failed to fetch" errors**
- Verify `NEXT_PUBLIC_API_URL` is set in Vercel
- Check that backend CORS includes your Vercel URL
- Test backend health endpoint directly

**Frontend not updating after changes**
- Vercel auto-deploys on push
- Check Vercel dashboard for deployment status

---

## Cost Estimates

### Azure App Service
- **Basic B1**: ~$13/month (good for testing)
- **Standard S1**: ~$55/month (production ready)

### Vercel
- **Hobby**: Free (personal projects)
- **Pro**: $20/month (team projects)

### Azure AI Foundry
- Pay-per-use based on tokens consumed
- Approximately $0.50-2.00 per meeting (depending on length)

---

## Next Steps (Optional)

1. **Custom Domain**: Add your own domain in Vercel settings
2. **Monitoring**: Set up Application Insights in Azure
3. **Scaling**: Upgrade App Service tier if needed
4. **Queue System**: Add Azure Queue for handling concurrent requests
5. **Database**: Store meeting summaries for history

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review GitHub Actions logs
3. Check Azure App Service logs
4. Check Vercel deployment logs

Happy deploying! 🚀
