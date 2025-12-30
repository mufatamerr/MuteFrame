# Install yt-dlp for YouTube Download Support

The YouTube downloader requires `yt-dlp` (or `youtube-dl`) to work reliably. `yt-dlp` is the modern, actively maintained fork of `youtube-dl` and supports YouTube Shorts and all YouTube formats.

## Installation

### macOS (using Homebrew)
```bash
brew install yt-dlp
```

### Linux
```bash
# Using pip (recommended)
pip install yt-dlp

# Or using apt (if available)
sudo apt install yt-dlp
```

### Windows
```bash
# Using pip
pip install yt-dlp

# Or download from: https://github.com/yt-dlp/yt-dlp/releases
```

## Verify Installation

After installing, verify it works:
```bash
yt-dlp --version
```

## Why yt-dlp?

- ✅ Actively maintained and updated
- ✅ Supports YouTube Shorts
- ✅ Better error handling
- ✅ More reliable than youtube-dl
- ✅ Handles all YouTube URL formats

Once installed, restart your server and YouTube downloads should work!

