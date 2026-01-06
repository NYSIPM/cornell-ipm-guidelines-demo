#!/bin/bash
set -e

echo "Installing Quarto..."
QUARTO_VERSION="1.4.550"
wget -q https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.tar.gz
tar -xzf quarto-${QUARTO_VERSION}-linux-amd64.tar.gz
export PATH="${PWD}/quarto-${QUARTO_VERSION}/bin:${PATH}"

echo "Quarto version:"
quarto --version

echo "Rendering site..."
quarto render

echo "Build complete!"