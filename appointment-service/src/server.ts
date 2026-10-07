import { createApp } from './app';
import { config } from './config/env';
import { kafka } from './events/kafka';
import { startOutboxPublisher, stopOutboxPublisher } from './events/outboxPublisher';
import { startConsultationCompletedConsumer } from './events/consultationCompletedConsumer';
import { pool } from './db/pool';
import { Consumer, Producer } from 'kafkajs';

let producer: Producer | undefined;
let consumer: Consumer | undefined;

/**
 * Connects the Kafka producer/consumer in the background with retry, so a slow or momentarily
 * unavailable broker never prevents the HTTP server (sync booking traffic) from starting.
 * kafkajs's own `retry` config (see src/events/kafka.ts) handles backoff within each connect
 * attempt; this loop retries the attempt itself if it still fails after those retries.
 */
async function connectKafkaWithRetry(): Promise<void> {
  const RETRY_DELAY_MS = 5000;
  for (;;) {
    try {
      const p = kafka.producer();
      await p.connect();
      producer = p;
      startOutboxPublisher(p);
      // eslint-disable-next-line no-console
      console.log('Kafka producer connected; outbox publisher started.');
      break;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Kafka producer connect failed, retrying in ${RETRY_DELAY_MS}ms`, err);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  for (;;) {
    try {
      consumer = await startConsultationCompletedConsumer();
      // eslint-disable-next-line no-console
      console.log('consultation.completed consumer started.');
      break;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Kafka consumer start failed, retrying in ${RETRY_DELAY_MS}ms`, err);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

async function main(): Promise<void> {
  const app = createApp();

  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`appointment-service listening on port ${config.port}`);
  });

  // Fire-and-forget: HTTP traffic (including booking, which only needs Postgres + the two sync
  // clients) is served immediately; Kafka wiring comes up independently in the background.
  void connectKafkaWithRetry();

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down...`);
    stopOutboxPublisher();
    server.close();
    if (producer) {
      try {
        await producer.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (consumer) {
      try {
        await consumer.disconnect();
      } catch {
        /* ignore */
      }
    }
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during startup', err);
  process.exit(1);
});
