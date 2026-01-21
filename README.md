<p align="center">
  <img src="public/icons/icon-192.png" alt="Codebook Logo" width="120" height="120">
</p>

<h1 align="center">CodeBook</h1>

<p align="right">
  <img src="https://komarev.com/ghpvc/?username=k-m-irfan&repo=codebook-next&label=Visitors&color=4a7cff&style=flat" alt="Visitors">
</p>

A VSCode-like IDE designed for smartphones and tablets. While it works on desktop computers as well, the interface is primarily optimized for mobile form factors with touch-friendly controls and gestures.

<p align="center">
  <img src="public/preview.gif" alt="Codebook Preview" width="300">
</p>

## Features

### Local Development
- **Local Terminal** - Full terminal access on your device with gesture support for cursor navigation
- **File Browser** - Browse, create, edit, and delete files and folders
- **Code Editor** - Monaco-based editor (same as VSCode) with syntax highlighting for multiple languages
- **Quick Keys Panel** - Easy access to special characters and modifier keys for efficient terminal usage

### Remote Development
- **SSH Connection** - Connect to remote machines using SSH
- **SSH Config Support** - Automatically reads your `~/.ssh/config` for saved hosts
- **Remote Terminal** - Full terminal access to remote machines
- **Remote File Browser** - Browse and manage files on remote servers
- **Remote Code Editing** - Edit files on remote machines with full editor features

### Mobile-Optimized
- **Touch Gestures** - Swipe to navigate cursor in terminal, pinch-to-zoom for font sizing
- **Responsive Layout** - Adapts to portrait and landscape orientations
- **Session Management** - Keep multiple sessions alive and switch between them
- **PWA Support** - Install as a standalone app on your device

## Installation

### Prerequisites
Make sure you have `curl` installed:

**Termux (Android):**
```bash
pkg install curl
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt install curl
```

### Quick Install
Run the following command:
```bash
curl -sL https://raw.githubusercontent.com/k-m-irfan/codebook-next/main/install.sh | bash
```

### Manual Installation

**Termux (Android):**
```bash
cd ~
pkg install git nodejs
git clone https://github.com/k-m-irfan/codebook-next.git
cd codebook-next
npm install
npm run build
echo "cd ~/codebook-next && npm run start &" >> ~/.bash_profile
```

**Linux (Debian/Ubuntu):**
```bash
cd ~
sudo apt install git nodejs npm
git clone https://github.com/k-m-irfan/codebook-next.git
cd codebook-next
npm install
npm run build
echo "cd ~/codebook-next && npm run start &" >> ~/.bashrc
```

### Post-Installation
1. Kill Termux completely and restart it
2. Open a browser and go to `localhost:3000`
3. Install as PWA: tap the three dots menu > "Install" or "Add to Home Screen"
4. Launch the installed app from your home screen

## Usage

### Connecting to Local Terminal
- Tap on "Local" from the Hosts screen to open a local terminal session

### Adding Remote Hosts
- Tap "Add Remote Host" to add a new SSH connection
- Or add hosts directly to your `~/.ssh/config` file - they will appear automatically

### Terminal Gestures
- **Swipe horizontally** - Move cursor left/right
- **Swipe vertically** - Move cursor up/down (history navigation)
- **Double tap** - Tab completion
- **Pinch** - Zoom in/out to adjust font size

### Settings
- Tap the gear icon on the home screen to access settings
- Adjust default font sizes for terminal and editor

## Tech Stack
- **Next.js** - React framework
- **Monaco Editor** - Code editor (VSCode's editor)
- **xterm.js** - Terminal emulator
- **node-pty** - Terminal backend
- **ssh2** - SSH client for remote connections

## Contributing
Feel free to contribute and help develop this project further! Whether it's bug fixes, new features, documentation improvements, or suggestions - all contributions are welcome.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

If you have ideas or find issues, please open an issue on GitHub.
