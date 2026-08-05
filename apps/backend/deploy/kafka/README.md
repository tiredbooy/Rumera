# Local Kafka (Redpanda) for notifications

See **`docs/architecture/notifications-kafka.md`** for the full design.

## Easy path (recommended for day-to-day)

Keep **`NOTIFICATIONS_MODE=inline`** (default) and **`SMS_PROVIDER=log`**.  
OTP codes and emails go straight from the API — no Kafka required.

## Async path (outbox → Kafka → worker)

### 1. Start broker

```bash
# from repo root
make kafka-up

# or
cd apps/backend/deploy/kafka
docker compose -f docker-compose.kafka.yml up -d
```

- Kafka API (host): `localhost:19092`
- Redpanda console: `http://localhost:8085`

### 2. Topics (created by init)

- `rumera.notification.otp.v1`
- `rumera.notification.email.v1`
- `*.dlq` companions

### 3. API in async mode

```bash
export NOTIFICATIONS_MODE=async
export KAFKA_BROKERS=localhost:19092
# + normal DB env (or apps/backend/.env)
go run ./cmd/server
```

### 4. Worker

```bash
# from repo root
export KAFKA_BROKERS=localhost:19092
export NOTIFICATION_WORKER_MODE=all   # all | relay | consume | log
make notification-worker

# smoke lifecycle without brokers:
NOTIFICATION_WORKER_MODE=log go run ./cmd/notification-worker
```

| Mode | Behaviour |
|------|-----------|
| `all` | Outbox relay → Kafka **and** consumer → SMS/email (default when brokers set) |
| `relay` | Outbox → Kafka only |
| `consume` | Kafka → providers only |
| `log` | Idle heartbeat (no brokers required) |

### 5. Stop

```bash
make kafka-down
```
