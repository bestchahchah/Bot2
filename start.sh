#!/bin/bash
set -e

# Install dependencies
pip install -r requirements.txt

# Start the bot
python3 bot.py