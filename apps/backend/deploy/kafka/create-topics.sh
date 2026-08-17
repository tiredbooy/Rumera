#!/bin/sh
# create-topics.sh v1
# Versioned bootstrap for prod/dev Redpanda topics.
# retention.ms defaults to 720h (EVENTS_RETENTION) so a group down for more
# than a week cannot lose facts the outbox still considers published.
set -eu

BROKERS="${KAFKA_BROKERS:-redpanda:9092}"
# 720h = 30d = 2_592_000_000 ms
RETENTION_MS="${KAFKA_RETENTION_MS:-2592000000}"

rpkx() {
	if [ -n "${KAFKA_SASL_USERNAME:-}" ]; then
		rpk "$@" --brokers "$BROKERS" \
			-X user="$KAFKA_SASL_USERNAME" \
			-X pass="${KAFKA_SASL_PASSWORD:-}" \
			-X sasl.mechanism="${KAFKA_SASL_MECHANISM:-SCRAM-SHA-512}"
	else
		rpk "$@" --brokers "$BROKERS"
	fi
}

ensure() {
	topic=$1
	parts=$2
	# create is not idempotent — already-exists is the normal restart case.
	rpkx topic create "$topic" -p "$parts" -r 1 \
		-c "retention.ms=${RETENTION_MS}" || true
	rpkx topic alter-config "$topic" --set "retention.ms=${RETENTION_MS}"
}

ensure rumera.notification.otp.v1 3
ensure rumera.notification.email.v1 3
ensure rumera.notification.otp.v1.dlq 1
ensure rumera.notification.email.v1.dlq 1
ensure rumera.domain.v1 3
ensure rumera.domain.v1.dlq 1

rpkx topic list > /tmp/topics
for topic in \
	rumera.notification.otp.v1 \
	rumera.notification.email.v1 \
	rumera.notification.otp.v1.dlq \
	rumera.notification.email.v1.dlq \
	rumera.domain.v1 \
	rumera.domain.v1.dlq
do
	grep -q "$topic" /tmp/topics || {
		echo "FATAL: topic $topic missing"
		exit 1
	}
done
echo "topics ready (retention.ms=${RETENTION_MS})"
