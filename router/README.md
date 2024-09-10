# GraphQL Summit 2024 Router performance workshop

This workbench provides a simulated observability stack for a supergraph.
You can execute queries against the router and see how things change.

## Useful links

### Execution
* [Apollo sandbox](http://localhost:4000) - Run graphql queries

### Configuration
* [Router yaml](./router.yaml) - Confgure the router
* [Supergraph schema](./supergraph.graphql) - The supergraph schema that the router is using

### Observability
* [Metrics and tracing and logs](http://localhost:3000/d/router/router-dashboard?orgId=1) - Monitor metrics traces and logs via Grafana
* [studio organization](https://studio.apollographql.com/org/graphql-summit-performance-workshop/invite/033655ae-f17a-4a2b-b36a-5d0c81e0cc0b)

## Step 1: gathering data

## Step 1.1: my telemetry is very sick

* reducing the sampling rate
=> getting a more manageable

```yaml
telemetry:
  exporters:
    tracing:
      common:
        sampler: 0.1
```


```yaml
supergraph:
  introspection: true
  listen: 0.0.0.0:4000
  query_planning:
    warmed_up_queries: 5
    # experimental_paths_limit: 3000
    experimental_plans_limit: 10
```


```yaml

# preview_demand_control:
#   enabled: true
#   mode: measure
#   strategy:
#     static_estimated:
#       list_size: 10 
#       max: 1000 

preview_entity_cache:
  enabled: true

  # Configure Redis
  redis:
    urls: ["redis://redis:6379"]
    timeout: 5ms # Optional, by default: 2ms
    ttl: 24h # Optional, by default no expiration

  subgraph:
    all:
      enabled: true


traffic_shaping:
#   all:
#     experimental_enable_http2: false
#   subgraphs:
#     products:
#       experimental_enable_http2: true
  router:
    timeout: 20s
  all:
    timeout: 10s
```


```yaml
telemetry:
  instrumentation:
    spans:
      mode: spec_compliant
    instruments:
      cache:
        apollo.router.operations.entity.cache:
          attributes:
            entity.type: true
            subgraph.name:
              subgraph_name: true
            supergraph.operation.name:
              supergraph_operation_name: string
```