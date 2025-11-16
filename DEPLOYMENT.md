# 🚀 Blockchain Node Deployment Guide

Deploy your Ziwio blockchain node to production with these cloud providers.

---

## 🌟 Recommended: Railway.app (Easiest & Free)

**Pros:**
- ✅ Free tier with $5 monthly credit
- ✅ Automatic deployments from GitHub
- ✅ WebSocket support included
- ✅ Simple setup (2 minutes)
- ✅ Free SSL certificate

### Steps:

1. **Create GitHub Repository (if not already)**
   ```bash
   cd /Users/arsenispapachristos/Desktop/Blockchainapp/BlockchainAPP/server
   git init
   git add .
   git commit -m "Initial blockchain node setup"
   gh repo create ziwio-blockchain-node --public --source=. --push
   ```

2. **Deploy to Railway**
   - Go to [railway.app](https://railway.app)
   - Click "Start a New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `ziwio-blockchain-node` repository
   - Railway will auto-detect Node.js and deploy
   - **Important:** Add environment variables:
     - `PORT` = (use Railway's default PORT)
     - `WS_PORT` = 8334
     - `NODE_ENV` = production

3. **Get Your URL**
   - Railway provides: `https://your-app.up.railway.app`
   - Use this URL in your iOS app

4. **Monitor**
   - View logs in Railway dashboard
   - Check `/health` endpoint

---

## 🎨 Option 2: Render.com (Free Tier)

**Pros:**
- ✅ Completely free tier
- ✅ Auto-deploy from GitHub
- ✅ Great for side projects

### Steps:

1. **Push to GitHub** (same as Railway step 1)

2. **Deploy to Render**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Render will use the `render.yaml` file automatically
   - Or manually configure:
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`

3. **Environment Variables**
   - Set in Render dashboard:
     - `NODE_ENV` = production
     - `PORT` = (Render sets this automatically)
     - `WS_PORT` = 8334

4. **Get Your URL**
   - Render provides: `https://ziwio-blockchain-node.onrender.com`

**Note:** Free tier sleeps after 15 min of inactivity (takes ~30s to wake up)

---

## 🔷 Option 3: Heroku (Paid - $5/month minimum)

**Note:** Heroku removed free tier in 2022. Costs $5/month minimum.

### Steps:

1. **Install Heroku CLI**
   ```bash
   brew tap heroku/brew && brew install heroku
   ```

2. **Login and Create App**
   ```bash
   cd /Users/arsenispapachristos/Desktop/Blockchainapp/BlockchainAPP/server
   heroku login
   heroku create ziwio-blockchain-node
   ```

3. **Deploy**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push heroku main
   ```

4. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set WS_PORT=8334
   ```

5. **Get Your URL**
   ```bash
   heroku open
   ```

---

## ☁️ Option 4: DigitalOcean App Platform (Free for 3 months)

**Pros:**
- ✅ $0 for first 3 months, then $5/month
- ✅ More control than serverless options
- ✅ Better for high traffic

### Steps:

1. **Push to GitHub** (same as Railway)

2. **Deploy to DigitalOcean**
   - Go to [cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps)
   - Click "Create App"
   - Connect GitHub repository
   - Configure:
     - **Type:** Web Service
     - **Build Command:** `npm install`
     - **Run Command:** `npm start`
     - **Port:** 8333

3. **Environment Variables**
   - Add in App Settings:
     - `NODE_ENV` = production
     - `WS_PORT` = 8334

---

## 🔧 Option 5: AWS EC2 (Free for 12 months, then ~$5/month)

**Best for:** Full control, production scale

### Quick Setup:

1. **Launch EC2 Instance**
   - Go to AWS Console → EC2
   - Launch Ubuntu t2.micro (free tier)
   - Download `.pem` key file

2. **SSH and Setup**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Clone your repo
   git clone https://github.com/yourusername/ziwio-blockchain-node.git
   cd ziwio-blockchain-node

   # Install dependencies
   npm install

   # Install PM2 (process manager)
   sudo npm install -g pm2

   # Start server
   pm2 start blockchain-node.js --name ziwio-node
   pm2 startup
   pm2 save
   ```

3. **Configure Security Group**
   - Allow inbound: Port 8333 (HTTP)
   - Allow inbound: Port 8334 (WebSocket)

4. **Get Your URL**
   - Use: `http://your-ec2-ip:8333`
   - Or setup domain + Nginx reverse proxy

---

## 🏆 Comparison Table

| Platform | Cost | Setup Time | WebSockets | Auto-Deploy | Best For |
|----------|------|------------|------------|-------------|----------|
| **Railway** | Free ($5 credit) | 2 min | ✅ | ✅ | Quick start |
| **Render** | Free | 3 min | ✅ | ✅ | Side projects |
| **Heroku** | $5/mo | 5 min | ✅ | ✅ | Enterprise |
| **DigitalOcean** | Free 3mo, $5/mo | 5 min | ✅ | ✅ | Scalability |
| **AWS EC2** | Free 12mo, $5/mo | 15 min | ✅ | ❌ | Full control |

---

## 📱 Update Your iOS App

After deployment, update your Swift code:

```swift
// In your NetworkLayer.swift or similar file
let BLOCKCHAIN_SERVER = "https://your-app.up.railway.app" // or your deployed URL
let BLOCKCHAIN_WS = "wss://your-app.up.railway.app" // Note: wss:// for secure WebSocket
```

---

## ✅ Testing Your Deployment

```bash
# Test health endpoint
curl https://your-deployed-url.com/health

# Test peers endpoint
curl https://your-deployed-url.com/peers

# Test WebSocket (using wscat)
npm install -g wscat
wscat -c wss://your-deployed-url.com
```

---

## 🔐 Production Checklist

- [ ] Use HTTPS (all platforms provide free SSL)
- [ ] Set `NODE_ENV=production`
- [ ] Monitor server logs
- [ ] Set up error tracking (Sentry, LogRocket)
- [ ] Configure CORS if needed
- [ ] Add rate limiting for API endpoints
- [ ] Set up automatic backups
- [ ] Monitor uptime (UptimeRobot, Pingdom)

---

## 🆘 Troubleshooting

**Server won't start:**
```bash
# Check logs on Railway/Render dashboard
# Verify PORT environment variable is set
# Ensure dependencies installed: npm install
```

**WebSocket not connecting:**
```bash
# Use wss:// (not ws://) for HTTPS deployments
# Check firewall allows port 8334
# Verify WS_PORT environment variable
```

**App sleeps on Render:**
```bash
# Free tier sleeps after 15 min
# Upgrade to paid tier ($7/mo) to prevent sleeping
# Or use Railway instead
```

---

## 🎯 Recommended: Start with Railway

**Why Railway?**
- Free tier is generous ($5/month credit)
- Automatic HTTPS + WebSockets
- Simple GitHub integration
- No credit card required to start

**Next Steps:**
1. Push your code to GitHub
2. Connect to Railway
3. Deploy in 2 minutes
4. Get your URL
5. Update iOS app

---

Need help? Check the logs in your platform's dashboard or contact support.
