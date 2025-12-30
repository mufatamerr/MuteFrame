# Fix YouTube Download Error (410)

The error you're seeing (Status code: 410) means YouTube has deprecated the API endpoint that the current `ytdl-core` package uses.

## Quick Fix

Run these commands in your terminal:

```bash
cd "/Users/mustafatamer/Personal Portfolio Projects/yt_censor/server"
npm uninstall ytdl-core
npm install @distube/ytdl-core@latest
```

Then restart your server:

```bash
npm run dev
```

## What Changed

- Updated from `ytdl-core` (unmaintained) to `@distube/ytdl-core` (actively maintained)
- This fork is regularly updated to work with YouTube's API changes

## Alternative: Use MP4 Upload

If YouTube downloads continue to have issues, you can always:
1. Download the YouTube video manually using a tool like `yt-dlp` or a browser extension
2. Upload the MP4 file directly to the app

This avoids any YouTube API issues entirely.

