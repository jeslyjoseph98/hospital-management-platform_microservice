import { Kafka, logLevel } from 'kafkajs';
import { config } from '../config/env';

export const kafka = new Kafka({
  clientId: 'appointment-service',
  brokers: config.kafkaBootstrap.split(',').map((s) => s.trim()),
  logLevel: logLevel.NOTHING,
  retry: { retries: 5 }
});
