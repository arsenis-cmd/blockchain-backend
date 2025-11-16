#!/bin/bash

# Quick deployment script for Railway.app
# Run: ./deploy-railway.sh

echo "🚀 Deploying Ziwio Blockchain Node to Railway.app"
echo "=================================================="

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed"
    echo "Install it with: brew install gh"
    exit 1
fi

# Check if user is logged into GitHub
if ! gh auth status &> /dev/null; then
    echo "🔐 Logging into GitHub..."
    gh auth login
fi

# Initialize git if not already
if [ ! -d .git ]; then
    echo "📦 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial blockchain node setup"
fi

# Create GitHub repository
echo "📤 Creating GitHub repository..."
REPO_NAME="ziwio-blockchain-node"

if gh repo view $REPO_NAME &> /dev/null; then
    echo "✅ Repository already exists"
else
    gh repo create $REPO_NAME --public --source=. --push
    echo "✅ Repository created and pushed"
fi

echo ""
echo "✅ Setup Complete!"
echo ""
echo "Next Steps:"
echo "1. Go to https://railway.app"
echo "2. Click 'Start a New Project'"
echo "3. Select 'Deploy from GitHub repo'"
echo "4. Choose '$REPO_NAME'"
echo "5. Railway will auto-deploy your node"
echo ""
echo "Set these environment variables in Railway:"
echo "  - NODE_ENV = production"
echo "  - WS_PORT = 8334"
echo ""
echo "Your blockchain node will be live in ~2 minutes!"
