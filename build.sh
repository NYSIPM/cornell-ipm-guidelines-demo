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

echo "=== Rendering Quarto Site ==="
quarto render

echo "=== Copying admin folder to docs ==="
cp -r admin docs/admin

echo "=== Build Complete ==="
echo "Contents of docs/ directory:"
ls -la docs/

echo "Checking admin folder was copied:"
ls -la docs/admin/