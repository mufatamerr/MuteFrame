#!/bin/bash

# Setup script for .env file

echo "Setting up .env file for the server..."
echo ""

# Navigate to server directory
cd "$(dirname "$0")/server"

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing .env file."
        exit 0
    fi
fi

# Get OpenAI API key from user
echo "Enter your OpenAI API key:"
echo "(You can get one from https://platform.openai.com/api-keys)"
read -r OPENAI_KEY

# Create .env file
cat > .env << EOF
OPENAI_API_KEY=$OPENAI_KEY
PORT=3001
EOF

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "Contents:"
cat .env | sed 's/OPENAI_API_KEY=.*/OPENAI_API_KEY=***hidden***/'
echo ""
echo "You can now start the server with: npm run dev"

