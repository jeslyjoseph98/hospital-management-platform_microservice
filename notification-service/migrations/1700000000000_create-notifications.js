/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('notifications', {
    id: { type: 'bigint', notNull: true, primaryKey: true, generated: { precedence: 'ALWAYS', identity: true } },
    event_id: { type: 'uuid', notNull: true, unique: true },
    patient_id: { type: 'bigint', notNull: true },
    title: { type: 'varchar(100)', notNull: true },
    message: { type: 'varchar(500)', notNull: true },
    appointment_id: { type: 'bigint' },
    is_read: { type: 'boolean', notNull: true, default: false },
    read_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });

  pgm.createIndex('notifications', ['patient_id', 'is_read', { name: 'created_at', sort: 'DESC' }], {
    name: 'idx_ntf_patient'
  });
};

exports.down = (pgm) => {
  pgm.dropTable('notifications');
};
