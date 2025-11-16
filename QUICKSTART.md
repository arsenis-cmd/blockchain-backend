# ⚡ Quick Start - Deploy in 5 Minutes

## 🎯 Fastest Option: Railway.app (Recommended)

### Step 1: Run the deployment script
```bash
cd /Users/arsenispapachristos/Desktop/Blockchainapp/BlockchainAPP/server
./deploy-railway.sh
```

This will:
- Create a GitHub repository
- Push your code
- Give you instructions for Railway deployment

### Step 2: Deploy on Railway
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (free)
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select **"ziwio-blockchain-node"**
5. Click **"Deploy"**

### Step 3: Configure Environment Variables
In Railway dashboard:
1. Go to your project → **"Variables"** tab
2. Add:
   - `NODE_ENV` = `production`
   - `WS_PORT` = `8334`
3. Save (Railway auto-redeploys)

### Step 4: Get Your URL
- Railway provides: `https://ziwio-blockchain-node-production.up.railway.app`
- Copy this URL

### Step 5: Test Your Deployment
```bash
curl https://your-railway-url.up.railway.app/health
```

You should see:
```json
{
  "status": "healthy",
  "uptime": 15.23,
  "peers": 0,
  "blockHeight": 0
}
```

---

## 📱 Update Your iOS App

Find your network configuration in Swift and update:

```swift
// Change from:
let serverURL = "http://localhost:8333"

// To:
let serverURL = "https://your-railway-url.up.railway.app"
let websocketURL = "wss://your-railway-url.up.railway.app"
```

Look for these files in your iOS project:
- `NetworkLayer.swift`
- `SeedNodeManager.swift`
- `BlockchainSynchronization.swift`

---

## ✅ Done!

Your blockchain node is now:
- ✅ Running 24/7 on the cloud
- ✅ Accessible from anywhere
- ✅ Auto-scaling and monitored
- ✅ Free (Railway gives $5/month credit)

---

## 🔍 Monitor Your Server

**Railway Dashboard:**
- View logs in real-time
- Check CPU/Memory usage
- Monitor deployments

**API Endpoints:**
- `/health` - Server status
- `/peers` - Connected iOS devices
- `/blocks` - Blockchain data

---

## 🆘 Need Help?

**Script won't run:**
```bash
chmod +x deploy-railway.sh
./deploy-railway.sh
```

**Don't have GitHub CLI:**
```bash
brew install gh
gh auth login
```

**Manual deployment:**
See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

---

## 🎉 What's Next?

1. **Test from your iPhone:**
   - Build and run your iOS app
   - Check if it connects to the cloud server
   - View logs in Railway dashboard

2. **Monitor Performance:**
   - Watch the `/peers` endpoint
   - See blocks being created

3. **Scale Up (Optional):**
   - Upgrade Railway plan if needed
   - Add multiple regions
   - Set up monitoring alerts

---

**Total Time:** ~5 minutes
**Cost:** Free (Railway $5/month credit)
**Difficulty:** Easy ⭐⭐☆☆☆
