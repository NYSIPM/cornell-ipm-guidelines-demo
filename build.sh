#!/bin/bash

echo "=== Installing Quarto ==="
QUARTO_VERSION="1.4.550"
wget -q "https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.tar.gz"
tar -xzf "quarto-${QUARTO_VERSION}-linux-amd64.tar.gz"
export PATH="${PWD}/quarto-${QUARTO_VERSION}/bin:${PATH}"

quarto --version

echo "=== Installing TinyTeX for PDF generation ==="
quarto install tinytex --no-prompt
echo "✓ TinyTeX installed successfully"

echo "=== Rendering Root Site ==="
quarto render

echo "=== Rendering Grape Guidelines ==="
cd publications/grapes
quarto render
cd ../..

echo "=== Copying admin folder ==="
mkdir -p docs/admin
cp -r admin/* docs/admin/

echo "=== Ensuring grapes output is in correct location ==="
# The grapes _quarto.yml should output to ../../docs/grapes
# but let's verify it's there
if [ -d "docs/grapes" ]; then
  echo "✓ Grapes guidelines rendered successfully"
  echo "Checking for PDFs:"
  ls -la docs/grapes/*.pdf 2>/dev/null || echo "No PDFs found"
  echo ""
  echo "All grapes files:"
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