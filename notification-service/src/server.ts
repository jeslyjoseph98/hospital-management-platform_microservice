import { config } from './config/env';
import { buildApp } from './app';
import { startConsumer } from './events/consumer';

async function main(): Promise<void> {
  const app = buildApp();

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`notification-service listening on port ${config.port}`);
  });

  try {
    await startConsumer();
    // eslint-disable-next-line no-console
    console.log('Kafka consumer started (group: notification-service, topic: appointment.booked)');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start Kafka consumer', err);
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error', err);
  process.exit(1);
});
