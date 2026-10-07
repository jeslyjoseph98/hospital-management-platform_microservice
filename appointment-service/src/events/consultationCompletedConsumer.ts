import { Consumer } from 'kafkajs';
import { kafka } from './kafka';
import { handleConsultationCompleted } from '../services/consultationCompletedService';

const TOPIC = 'consultation.completed';

export async function startConsultationCompletedConsumer(): Promise<Consumer> {
  const consumer = kafka.consumer({ groupId: 'appointment-service' });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const envelope = JSON.parse(message.value.toString());
        const payload = envelope.payload ?? envelope;
        if (payload && typeof payload.appointmentId === 'number') {
          await handleConsultationCompleted({
            consultationId: String(payload.consultationId),
            appointmentId: payload.appointmentId
          });
        }
      } catch (err) {
        // Log and move on; a poison message should not block the consumer.
        // eslint-disable-next-line no-console
        console.error('Failed to process consultation.completed message', err);
      }
    }
  });

  return consumer;
}
