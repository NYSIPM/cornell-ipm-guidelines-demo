#!/bin/bash

echo "=== Installing Quarto ==="
QUARTO_VERSION="1.4.550"
QUARTO_URL="https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.tar.gz"

echo "Downloading Quarto ${QUARTO_VERSION}..."
wget -q "${QUARTO_URL}"

echo "Extracting Quarto..."
tar -xzf "quarto-${QUARTO_VERSION}-linux-amd64.tar.gz"

echo "Setting up Quarto path..."
export PATH="${PWD}/quarto-${QUARTO_VERSION}/bin:${PATH}"

echo "Verifying Quarto installation..."
quarto --version

echo "=== Checking _quarto.yml ==="
cat _quarto.yml

echo "=== Inspecting project with quarto inspect ==="
quarto inspect

echo "=== Rendering Quarto Site ==="
quarto render --verbose

echo "=== Build Complete ==="
echo "Contents of current directory:"
ls -la

echo "Contents of docs/ directory:"
ls -la docs/

echo "All HTML files in project:"
find . -name "*.html" -type f | head -20