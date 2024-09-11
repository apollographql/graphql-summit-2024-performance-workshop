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
    logging:
      stdout:
        tty_format: json
        format: json
        rate_limit:
          capacity: 1
          interval: 3s
    tracing:
      common:
        sampler: 0.1
```

## Step 1.2 what to look for

look for logs when the router is overloaded

look at traces indicating what could be happening, especially traces for long requests

look for correlations between metrics

# Step 2: reducing inbound traffic

## Step 2.1 timeout
-> putting a hard limit on time spent

```yaml
traffic_shaping:
  router:
    timeout: 5s
```

Step 2.2: rate limiting

there are still too many requests, even if they don't take too much time (cf little's law)
so we need to reduce the rate

```yaml
traffic_shaping:
  router:
    timeout: 5s
    global_rate_limit:
      capacity: 500
      interval: 1s
```
# Step 3: subgraphs appear overloaded

We have to protect our subgraphs from traffic, so we will apply timeouts and rate limiting over there as well

```yaml
traffic_shaping:
  router:
    timeout: 5s
    global_rate_limit:
      capacity: 500
      interval: 1s
  all:
   timeout: 1s
   global_rate_limit:
     capacity: 100
     interval: 1s
```

# did we stabilize the situation?
rate limiting is working, we reject half the traffic
latency has reduced at subgraphs

# Step 4: looking subgraph by subgraph

The products subgraph still has some high latency
the reviews subgraphs throws 429 errors
maybe the rate limiting is too strict for reviews?

query deduplication

```yaml
traffic_shaping:
  router:
    timeout: 5s
    global_rate_limit:
      capacity: 500
      interval: 1s
  all:
    timeout: 1s
    global_rate_limit:
      capacity: 100
      interval: 1s
  subgraphs:
    reviews:
      deduplicate_query: true
```

This brings down the subgraph latency histogram and makes it way more stable, maybe we could activate it on all subgraphs?

```yaml
traffic_shaping:
  router:
    timeout: 5s
    global_rate_limit:
      capacity: 500
      interval: 1s
  all:
    timeout: 1s
    global_rate_limit:
      capacity: 100
      interval: 1s
    deduplicate_query: true
```

this is bringing down the overall latency for the client request
maybe we can relax the rate limiter now?

the rate limiter for reviews seems to be triggering but its latency is manageable, so let's relax that one first
it seems we have about 500 rps on reviews

```yaml
traffic_shaping:
  router:
    timeout: 5s
    global_rate_limit:
      capacity: 500
      interval: 1s
  all:
    timeout: 1s
    global_rate_limit:
      capacity: 100
      interval: 1s
      deduplicate_query: true
  subgraphs:
    reviews:
      global_rate_limit:
        capacity: 400
        interval: 1s
```

now let's relax the main rate limiter a bit

first at 700 RPS, then up to 1000 RPS

# Step 4: let's take a closer look at traces

We reduced the overall latency, but why are we still seeing a high p90?

some queries seem to wait a lot between spans => probably a high CPU consumption issue

some seem to spend a lot of time in the query planner

# Step 4: the query planner looks overloaded

the cache misses are all over the place

=> explain the query planner cache

```yaml
supergraph:
  introspection: true
  listen: 0.0.0.0:4000
  query_planning:
     cache:
      in_memory:
        limit: 100
```

we now see the query planner latency decrease, and p99 request latency decreases
explain the warmup:
```yaml
supergraph:
  introspection: true
  listen: 0.0.0.0:4000
  query_planning:
    warmed_up_queries: 5
```

explain the experimental plans:

```yaml
supergraph:
  introspection: true
  listen: 0.0.0.0:4000
  query_planning:
    experimental_plans_limit: 10
```

what is left now?

# Step 5: let's enable the entity cache

```yaml
preview_entity_cache:
  enabled: true

  # Configure Redis
  redis:
    urls: ["redis://redis:6379"]
    timeout: 5ms # Optional, by default: 2ms
    ttl: 10s # Optional, by default no expiration

  subgraph:
    all:
      enabled: true
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