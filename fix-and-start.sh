#!/bin/bash

echo "🔧 Fixing YouTube downloader and starting server..."
echo ""

cd "$(dirname "$0")/server"

echo "1. Uninstalling old ytdl-core..."
npm uninstall ytdl-core 2>/dev/null || echo "   (not installed or already removed)"

echo "2. Installing @distube/ytdl-core..."
npm install @distube/ytdl-core@latest

echo ""
echo "3. Checking if .env file exists..."
if [ ! -f .env ]; then
    echo "   ⚠️  .env file not found!"
    echo "   Creating .env file..."
    echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
    echo "PORT=3001" >> .env
    echo "   ✅ Created .env file - please edit it and add your OpenAI API key!"
else
    echo "   ✅ .env file exists"
fi

echo ""
echo "4. Starting server..."
echo "   (Press Ctrl+C to stop)"
echo ""

npm run dev

