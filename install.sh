#!/bin/bash

# Codebook Installation Script for Termux

echo "========================================="
echo "  Codebook - Mobile IDE Installation"
echo "========================================="
echo ""

# Check if running in Termux
if [ ! -d "/data/data/com.termux" ]; then
    echo "Warning: This script is designed for Termux on Android."
    echo "Proceeding anyway..."
    echo ""
fi

# Install dependencies
echo "[1/4] Installing dependencies..."
pkg install -y git nodejs
if [ $? -ne 0 ]; then
    echo "Error: Failed to install dependencies"
    exit 1
fi

# Clone repository
echo ""
echo "[2/4] Cloning repository..."
cd ~
if [ -d "codebook-next" ]; then
    echo "Directory codebook-next already exists. Pulling latest changes..."
    cd codebook-next
    git pull
else
    git clone https://github.com/k-m-irfan/codebook-next.git
    cd codebook-next
fi

if [ $? -ne 0 ]; then
    echo "Error: Failed to clone repository"
    exit 1
fi

# Install npm packages
echo ""
echo "[3/4] Installing npm packages..."
npm install
if [ $? -ne 0 ]; then
    echo "Error: Failed to install npm packages"
    exit 1
fi

# Add to bash profile for auto-start
echo ""
echo "[4/4] Configuring auto-start..."
if ! grep -q "codebook-next" ~/.bash_profile 2>/dev/null; then
    echo "cd ~/codebook-next && npm run start &" >> ~/.bash_profile
    echo "Added auto-start to ~/.bash_profile"
else
    echo "Auto-start already configured"
fi

echo ""
echo "========================================="
echo "  Installation Successful!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Kill Termux completely and restart it"
echo "2. Open a browser and go to: localhost:3000"
echo "3. Install as app:"
echo "   - Tap the three dots menu (top right)"
echo "   - Select 'Install' or 'Add to Home Screen'"
echo "   - Tap 'Install'"
echo "4. Launch Codebook from your home screen"
echo ""
echo "Enjoy coding on mobile!"
echo ""
