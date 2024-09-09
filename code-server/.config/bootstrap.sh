#!/bin/sh
echo "Installing extensions..."
code-server --install-extension redhat.vscode-yaml
code-server --install-extension bierner.markdown-preview-github-styles
code-server --install-extension bierner.markdown-mermaid
echo "Starting code-server..."
code-server --disable-telemetry --ignore-last-opened /etc/router
