#!/bin/bash

# Script to set up Python virtual environment for this project

set -e

echo "Setting up Python virtual environment..."

# Check if venv already exists
if [ -d "venv" ]; then
    echo "Virtual environment already exists."
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing existing virtual environment..."
        rm -rf venv
    else
        echo "Using existing virtual environment."
        echo ""
        echo "To activate the environment, run:"
        echo "  source venv/bin/activate"
        exit 0
    fi
fi

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies from requirements.txt..."
pip install -r requirements.txt

echo ""
echo "✓ Virtual environment setup complete!"
echo ""
echo "To activate the environment, run:"
echo "  source venv/bin/activate"
echo ""
echo "To deactivate, run:"
echo "  deactivate"
echo ""
echo "To run the plotting script:"
echo "  python3 plot_metrics.py --save"

