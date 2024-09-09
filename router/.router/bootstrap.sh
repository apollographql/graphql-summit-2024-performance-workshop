#!/bin/sh
id -u
/dist/router_wrapper.sh config schema > /etc/router/.router/schema.json
ROUTER_LOG=/var/log/router/router.log

until /dist/router_wrapper.sh --dev --config /etc/router/router.yaml --supergraph /etc/router/supergraph.graphql >> "$ROUTER_LOG"; do
    echo "Router stopped with exit code $?.  Respawning.." >&2
    rm "$ROUTER_LOG"
    sleep 1
done