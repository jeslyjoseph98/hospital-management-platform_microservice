/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('appointments', {
    id: { type: 'bigint', notNull: true, primaryKey: true, generated: { precedence: 'ALWAYS', identity: true } },
    appointment_code: { type: 'varchar(20)', unique: true },
    patient_id: { type: 'bigint', notNull: true },
    doctor_id: { type: 'bigint', notNull: true },
    appointment_date: { type: 'date', notNull: true },
    token_number: { type: 'int', notNull: true },
    reporting_time: { type: 'time', notNull: true },
    reason: { type: 'varchar(300)' },
    status: { type: 'varchar(20)', notNull: true, default: 'BOOKED' },
    patient_name: { type: 'varchar(100)', notNull: true },
    patient_code: { type: 'varchar(20)', notNull: true },
    patient_gender: { type: 'varchar(10)', notNull: true },
    patient_dob: { type: 'date', notNull: true },
    doctor_name: { type: 'varchar(100)', notNull: true },
    department_name: { type: 'varchar(100)', notNull: true },
    consultation_start: { type: 'time', notNull: true },
    consultation_end: { type: 'time', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz' }
  });

  pgm.addConstraint('appointments', 'chk_apt_token_number', 'CHECK (token_number >= 1)');
  pgm.addConstraint('appointments', 'chk_apt_status', "CHECK (status IN ('BOOKED','COMPLETED'))");
  pgm.addConstraint('appointments', 'uq_apt_token', {
    unique: ['doctor_id', 'appointment_date', 'token_number']
  });
  pgm.addConstraint('appointments', 'uq_apt_patient', {
    unique: ['patient_id', 'doctor_id', 'appointment_date']
  });

  pgm.createIndex('appointments', ['patient_id', 'appointment_date'], { name: 'idx_apt_patient' });
  pgm.createIndex('appointments', ['doctor_id', 'appointment_date'], { name: 'idx_apt_doctor_date' });

  pgm.createTable('doctor_day_counters', {
    doctor_id: { type: 'bigint', notNull: true },
    appointment_date: { type: 'date', notNull: true },
    booked_count: { type: 'int', notNull: true, default: 0 }
  });
  pgm.addConstraint('doctor_day_counters', 'pk_doctor_day_counters', {
    primaryKey: ['doctor_id', 'appointment_date']
  });

  pgm.createTable('outbox_events', {
    id: { type: 'bigint', notNull: true, primaryKey: true, generated: { precedence: 'ALWAYS', identity: true } },
    event_id: { type: 'uuid', notNull: true, unique: true },
    topic: { type: 'varchar(100)', notNull: true },
    message_key: { type: 'varchar(50)', notNull: true },
    payload: { type: 'jsonb', notNull: true },
    status: { type: 'varchar(10)', notNull: true, default: 'NEW' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    sent_at: { type: 'timestamptz' }
  });
  pgm.addConstraint('outbox_events', 'chk_ob_status', "CHECK (status IN ('NEW','SENT'))");
  pgm.createIndex('outbox_events', ['status', 'id'], { name: 'idx_ob_new' });
};

exports.down = (pgm) => {
  pgm.dropTable('outbox_events');
  pgm.dropTable('doctor_day_counters');
  pgm.dropTable('appointments');
};
