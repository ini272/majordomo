#!/bin/bash
# Session start hook for Claude Code
# Ensures pre-commit hooks are installed and ready to use

set -e

echo "🔧 Setting up pre-commit hooks..."

# Install pre-commit if not already installed
if ! command -v pre-commit &> /dev/null; then
    echo "📦 Installing pre-commit..."
    uv tool install pre-commit
fi

# Install git hooks
echo "🪝 Installing git hooks..."
pre-commit install

echo "✅ Pre-commit hooks ready!"
