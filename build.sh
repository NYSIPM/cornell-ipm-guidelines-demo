#!/bin/bash

echo "=== Installing Quarto ==="
QUARTO_VERSION="1.4.550"
wget -q "https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.tar.gz"
tar -xzf "quarto-${QUARTO_VERSION}-linux-amd64.tar.gz"
export PATH="${PWD}/quarto-${QUARTO_VERSION}/bin:${PATH}"

quarto --version

echo "=== Rendering Root Site ==="
quarto render

echo "=== Rendering Grape Guidelines ==="
cd publications/grapes
quarto render
cd ../..

echo "=== Copying admin folder ==="
mkdir -p docs/admin
cp -r admin/* docs/admin/

echo "=== Copying PDFs from source to output ==="
mkdir -p docs/publications/grapes
if cp publications/grapes/*.pdf docs/publications/grapes/ 2>/dev/null; then
  echo "✓ PDFs copied successfully"
  ls -la docs/grapes/*.pdf
else
  echo "⚠ No PDFs found in grapes/"
fi

echo "=== Ensuring grapes output is in correct location ==="
if [ -d "docs/grapes" ]; then
  echo "✓ Grapes guidelines rendered successfully"
  ls -la docs/grapes/
else
  echo "✗ WARNING: docs/grapes not found!"
fi

echo "=== Build Complete ==="
echo "Root docs contents:"
ls -la docs/
echo ""
echo "Grapes contents:"
ls -la docs/grapes/ 2>/dev/null || echo "grapes folder not found"