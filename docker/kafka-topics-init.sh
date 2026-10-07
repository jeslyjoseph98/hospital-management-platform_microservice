#!/usr/bin/env bash
# Pre-creates the 4 topics from SVC-00 §8.2 with 3 partitions / replication 1.
# Without this, a consumer that subscribes before any producer has ever sent
# to a topic can hit UNKNOWN_TOPIC_OR_PARTITION (auto-create-on-metadata-
# fetch is not reliably synchronous), and crash services that don't retry.
set -euo pipefail

BOOTSTRAP=kafka:9092
BIN=/opt/kafka/bin/kafka-topics.sh

until "$BIN" --bootstrap-server "$BOOTSTRAP" --list >/dev/null 2>&1; do
  echo "waiting for kafka..."
  sleep 2
done

for topic in \
  "user.doctor-account-registered" \
  "doctor.status-changed" \
  "appointment.booked" \
  "consultation.completed"
do
  "$BIN" --bootstrap-server "$BOOTSTRAP" --create --if-not-exists \
    --topic "$topic" --partitions 3 --replication-factor 1
done

echo "topics ready"
