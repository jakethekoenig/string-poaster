#!/bin/bash

# Install Node.js dependencies
npm install

# Install Python dependencies for Farcaster integration
pip3 install farcaster-py

# Make sure scripts are executable
chmod +x index.js
chmod +x login.js
chmod +x farcaster_poster.py

echo "Setup completed successfully!"
