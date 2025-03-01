#!/bin/bash

# Install dependencies
echo "Installing dependencies with pnpm..."
pnpm install

# Create public directory if it doesn't exist
mkdir -p public

# Run the application in development mode
echo "Starting the application in development mode..."
pnpm dev
