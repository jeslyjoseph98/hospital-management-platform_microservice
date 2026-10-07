CREATE TABLE users (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  full_name      VARCHAR(100) NOT NULL,
  phone          VARCHAR(15)  NOT NULL UNIQUE,      -- login id
  email          VARCHAR(100) NULL UNIQUE,
  password_hash  VARCHAR(100) NOT NULL,             -- BCrypt
  role           VARCHAR(20)  NOT NULL,
  doctor_id      BIGINT       NULL UNIQUE,          -- only for DOCTOR; id in doctor-service (no FK)
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at  DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_user_role CHECK (role IN ('PATIENT','ADMIN','DOCTOR','PHARMACIST'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE patients (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT       NOT NULL UNIQUE,
  patient_code   VARCHAR(20)  NULL UNIQUE,          -- PAT000123, set right after insert
  date_of_birth  DATE         NOT NULL,
  gender         VARCHAR(10)  NOT NULL,
  address        VARCHAR(250) NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pat_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT chk_pat_gender CHECK (gender IN ('MALE','FEMALE','OTHER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE outbox_events (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id     CHAR(36)     NOT NULL UNIQUE,
  topic        VARCHAR(100) NOT NULL,
  message_key  VARCHAR(50)  NOT NULL,
  payload      JSON         NOT NULL,
  status       VARCHAR(10)  NOT NULL DEFAULT 'NEW',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at      DATETIME     NULL,
  CONSTRAINT chk_ob_status CHECK (status IN ('NEW','SENT')),
  INDEX idx_ob_new (status, id)
) ENGINE=InnoDB;
