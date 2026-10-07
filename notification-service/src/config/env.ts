import 'dotenv/config';

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export const config = {
  port: parseInt(optional('PORT', '8085'), 10),
  pg: {
    host: optional('PGHOST', 'localhost'),
    port: parseInt(optional('PGPORT', '5432'), 10),
    database: optional('PGDATABASE', 'hms_notification'),
    user: optional('PGUSER', 'notification_service'),
    password: optional('PGPASSWORD', 'notification_service_pw')
  },
  kafkaBootstrap: optional('KAFKA_BOOTSTRAP', 'localhost:9092'),
  timezone: 'Asia/Kolkata'
};
