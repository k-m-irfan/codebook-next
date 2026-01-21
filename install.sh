#!/bin/bash

# Codebook Installation Script for Termux and Linux

echo "========================================="
echo "  Codebook - Mobile IDE Installation"
echo "========================================="
echo ""

# Detect environment
IS_TERMUX=false
PKG_MANAGER=""
PROFILE_FILE=""

if [ -d "/data/data/com.termux" ]; then
    IS_TERMUX=true
    PKG_MANAGER="pkg"
    PROFILE_FILE="$HOME/.bash_profile"
    echo "Detected: Termux (Android)"
elif command -v apt &> /dev/null; then
    PKG_MANAGER="apt"
    PROFILE_FILE="$HOME/.bashrc"
    echo "Detected: Linux (Debian/Ubuntu)"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    PROFILE_FILE="$HOME/.bashrc"
    echo "Detected: Linux (Fedora/RHEL)"
elif command -v pacman &> /dev/null; then
    PKG_MANAGER="pacman"
    PROFILE_FILE="$HOME/.bashrc"
    echo "Detected: Linux (Arch)"
else
    echo "Warning: Could not detect package manager."
    echo "Please install git and nodejs manually."
    PKG_MANAGER="unknown"
    PROFILE_FILE="$HOME/.bashrc"
fi
echo ""

# Install dependencies
echo "[1/5] Installing dependencies..."
if [ "$PKG_MANAGER" = "pkg" ]; then
    pkg install -y git nodejs
elif [ "$PKG_MANAGER" = "apt" ]; then
    sudo apt update
    sudo apt install -y git nodejs npm
elif [ "$PKG_MANAGER" = "dnf" ]; then
    sudo dnf install -y git nodejs npm
elif [ "$PKG_MANAGER" = "pacman" ]; then
    sudo pacman -Sy --noconfirm git nodejs npm
else
    echo "Skipping package installation. Please ensure git and nodejs are installed."
fi

if [ $? -ne 0 ] && [ "$PKG_MANAGER" != "unknown" ]; then
    echo "Error: Failed to install dependencies"
    exit 1
fi

# Clone repository
echo ""
echo "[2/5] Cloning repository..."
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
echo "[3/5] Installing npm packages..."
npm install
if [ $? -ne 0 ]; then
    echo "Error: Failed to install npm packages"
    exit 1
fi

# Build the app
echo ""
echo "[4/5] Building the app..."
npm run build
if [ $? -ne 0 ]; then
    echo "Error: Failed to build the app"
    exit 1
fi

# Add to profile for auto-start
echo ""
echo "[5/5] Configuring auto-start..."
if ! grep -q "codebook-next" "$PROFILE_FILE" 2>/dev/null; then
    echo "cd ~/codebook-next && npm run start &" >> "$PROFILE_FILE"
    echo "Added auto-start to $PROFILE_FILE"
else
    echo "Auto-start already configured"
fi

echo ""
echo "========================================="
echo "  Installation Successful!"
echo "========================================="
echo ""
echo "Next steps:"
if [ "$IS_TERMUX" = true ]; then
    echo "1. Kill Termux completely and restart it"
else
    echo "1. Restart your terminal or run: source $PROFILE_FILE"
fi
echo "2. Open a browser and go to: localhost:3000"
echo "3. Install as app (on mobile):"
echo "   - Tap the three dots menu (top right)"
echo "   - Select 'Install' or 'Add to Home Screen'"
echo "   - Tap 'Install'"
echo "4. Launch Codebook from your home screen or browser"
echo ""
echo "Enjoy coding!"
echo ""
