-- Stack B databases (appointment-service, notification-service)
CREATE DATABASE hms_appointment;
CREATE DATABASE hms_notification;

CREATE USER appointment_service WITH PASSWORD 'appointment_service_pw';
GRANT ALL PRIVILEGES ON DATABASE hms_appointment TO appointment_service;

CREATE USER notification_service WITH PASSWORD 'notification_service_pw';
GRANT ALL PRIVILEGES ON DATABASE hms_notification TO notification_service;

-- Postgres 15+ revokes CREATE on the public schema from non-owners by
-- default; without this, migrations fail with "permission denied for
-- schema public". \c switches the psql session to each database.
\c hms_appointment
GRANT ALL ON SCHEMA public TO appointment_service;

\c hms_notification
GRANT ALL ON SCHEMA public TO notification_service;
