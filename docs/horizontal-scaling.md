# Horizontal scaling

How to run FlowZen as several identical replicas behind a load balancer without
losing real-time updates, presence, or database throughput.

## What was made replica-safe

| Concern | Before | Now |
| --- | --- | --- |
| SSE notifications (`/api/events`) | Delivered only to clients connected to the instance that produced the event. Behind a load balancer, users on other replicas never saw notifications. | Events are fanned out through MongoDB (`realtimeevents` collection + change streams) and delivered by whichever instance holds the user's stream. No sticky sessions required. |
| Online/offline presence | `hasSubscriber()` only knew about the local process, so one replica could mark a user offline while another still held their stream. | Each instance heartbeats its connected users into `realtimepresence`; `isOnlineGlobally()` answers across all replicas. Rows expire via TTL, so crashed instances cannot leave users stuck online. |
| MongoDB connections | Driver defaults (up to 100 sockets per process, no wire compression). | Configurable per-process pool (`MONGODB_MAX_POOL_SIZE`, default 10 in production), `minPoolSize`, connection/idle timeouts, fail-fast `waitQueueTimeoutMS`, and zlib wire compression. |
| Health checks | None, so a load balancer could not tell a healthy replica from a broken one. | `GET /api/health` pings MongoDB and returns `503` when it cannot serve. |
| HTTP transport | No explicit keep-alive/compression/standalone output settings. | `httpAgentOptions.keepAlive`, `compress: true`, `poweredByHeader: false`, and `NEXT_OUTPUT=standalone` for container builds. |
| SSE behind proxies | Proxies could buffer the stream, batching or delaying events. | The stream sets `X-Accel-Buffering: no` and a `retry:` hint. |

## Requirements

- **MongoDB replica set.** Change streams need one. MongoDB Atlas provides this
  by default. A local `mongod` started as a standalone will log
  `EventHub: change streams unavailable, SSE fan-out is local-only.` and keep
  working — just without cross-instance events.
- **No sticky sessions.** Any replica can serve any request; SSE streams are
  independent and events route through the database.
- **Shared storage.** Uploads are written to the local filesystem
  (`public/uploads`), so if you scale out either pin uploads to object storage
  or mount a shared volume on every replica. Otherwise an avatar uploaded on
  replica A will 404 on replica B.

## Environment

```env
# Pool per process; keep replicas * MONGODB_MAX_POOL_SIZE under the plan limit
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=2
MONGODB_MAX_CONNECTING=4
MONGODB_MAX_IDLE_TIME_MS=30000
MONGODB_WAIT_QUEUE_TIMEOUT_MS=10000
MONGODB_COMPRESSORS=zlib
MONGODB_APP_NAME=flowzen

# Cross-instance realtime (defaults on in production)
REALTIME_FANOUT=on

# Optional log prefix; a random per-process suffix is always appended
INSTANCE_ID=flowzen-prod
```

### Sizing the pool

```
total connections = replicas * MONGODB_MAX_POOL_SIZE
```

Keep that below roughly 80% of the database plan's connection limit and leave
headroom for migrations, scripts, and Atlas itself. Example: 4 replicas × 20 =
80 sockets on a plan that allows 100.

Serverless platforms create many short-lived instances; keep the pool small
(the default 10 is chosen for that case). Long-lived containers with a fixed
replica count can raise it.

## Load balancer

Health check:

```
GET /api/health   -> 200 when ready, 503 while the database is unreachable
```

Use `/api/health` as the readiness probe and, on platforms that support it
(Kubernetes), `/api/health` as the liveness probe too. No timeout longer than
a few seconds is needed — the endpoint pings MongoDB with a 3s cap.

For SSE, disable response buffering and keep idle connections open longer than
the 15s heartbeat:

```nginx
upstream flowzen {
    least_conn;
    server app1:3000;
    server app2:3000;
}

server {
    location / {
        proxy_pass http://flowzen;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # SSE (/api/events): do not buffer, do not time out between heartbeats
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 120s;
    }
}
```

With a cloud load balancer, the equivalent settings are: idle timeout ≥ 60s,
response buffering off, and no per-request cookie affinity.

## Containers

```bash
NEXT_OUTPUT=standalone npm run build
# .next/standalone/server.js is the entrypoint for the image
docker run -p 3000:3000 -e MONGODB_URI=... flowzen:latest
```

Run the image as `docker compose up --scale app=3` (or a Kubernetes Deployment
with `replicas: 3`) behind the proxy above.

## Verifying a rollout

1. `curl http://<replica>/api/health` on each replica — all report
   `"realtime": { "fanout": "distributed" }` once a client has connected to
   that replica's SSE endpoint. `"idle"` means no SSE client has connected yet,
   `"disabled"` means `REALTIME_FANOUT=off`, and `"local"` means change streams
   are not available (standalone MongoDB).
2. Open a user session, then watch the replica logs while triggering a
   notification for that user from a different replica's API endpoint. The
   event should arrive without a page reload.
3. `db.realtimepresence.find()` should show one row per live instance with the
   connected user IDs.

## Known limitation

The in-process rate limiter (`lib/rate-limit.ts`, used by the middleware and by
login/PIN lockout) is per instance. With N replicas the effective login limit is
N× the configured value. That is acceptable for brute-force friction but not for
strict quotas; if you need a cluster-wide limit, put rate limiting in the load
balancer/WAF or move the buckets to a shared store.
