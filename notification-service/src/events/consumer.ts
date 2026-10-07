import { Kafka, logLevel } from 'kafkajs';
import { config } from '../config/env';
import { pool } from '../db/pool';
import { NotificationRepository } from '../repositories/notificationRepository';
import { handleAppointmentBooked } from './appointmentBookedHandler';
import { AppointmentBookedPayload, KafkaEnvelope } from './types';

const TOPIC_APPOINTMENT_BOOKED = 'appointment.booked';
const CONSUMER_GROUP = 'notification-service';

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [config.kafkaBootstrap],
  logLevel: logLevel.NOTHING
});

const consumer = kafka.consumer({ groupId: CONSUMER_GROUP });
const repository = new NotificationRepository(pool);

export async function startConsumer(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC_APPOINTMENT_BOOKED, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        // Nothing to process; do not throw, there's no useful payload to retry.
        return;
      }

      const envelope: KafkaEnvelope<AppointmentBookedPayload> = JSON.parse(
        message.value.toString('utf-8')
      );

      // NTF-R3: let any error bubble up out of eachMessage so kafkajs does not
      // commit the offset, and Kafka redelivers this message.
      await handleAppointmentBooked(repository, envelope);
    }
  });
}

export async function stopConsumer(): Promise<void> {
  await consumer.disconnect();
}
