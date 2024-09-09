#!/bin/sh

# Depending on arch choose the correct binary

arch=$(uname -m)
if [ "$arch" = "x86_64" ]; then
  binary="/etc/subgraphs/linux/amd64/subgraph"
elif [ "$arch" = "aarch64" ]; then
  binary="/etc/subgraphs/linux/arm64/subgraph"
else
  echo "Unsupported architecture: $arch"
  exit 1
fi

echo "Starting subgraphs"
while true; do
  "$binary" -schema /etc/router/supergraph.graphql &
  PID=$!
  # periodically check to see if the schema has changed. We don't use inotify as this doesn't work well in docker.
  # Instead we just check to see if the file timestamp has changed.
  while true; do
    sleep 1
    if [ /etc/router/supergraph.graphql -nt /proc/$PID ]; then
      echo "Schema changed, restarting subgraphs"
      kill $PID
      break
    fi
  done
done