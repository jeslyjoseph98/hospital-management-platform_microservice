CREATE TABLE departments (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  dept_name   VARCHAR(100) NOT NULL UNIQUE,     -- Cardiology
  description VARCHAR(300) NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_by  BIGINT       NULL,                -- admin user id (X-User-Id), no FK
  updated_by  BIGINT       NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE doctors (
  id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
  department_id        BIGINT        NOT NULL,
  full_name            VARCHAR(100)  NOT NULL,
  qualification        VARCHAR(150)  NOT NULL,         -- MBBS, MD (Cardiology)
  specialization       VARCHAR(100)  NOT NULL,         -- Cardiologist
  registration_number  VARCHAR(50)   NOT NULL UNIQUE,  -- medical council registration no.
  experience_years     INT           NOT NULL DEFAULT 0,
  phone                VARCHAR(15)   NOT NULL,         -- used to verify doctor registration
  email                VARCHAR(100)  NULL,
  about                VARCHAR(1000) NULL,             -- short profile shown to patients
  consultation_fee     DECIMAL(10,2) NOT NULL DEFAULT 0,   -- display only
  daily_limit          INT           NOT NULL DEFAULT 50,  -- max appointments per day
  login_registered     TINYINT(1)    NOT NULL DEFAULT 0,   -- set by event from user-service
  is_active            TINYINT(1)    NOT NULL DEFAULT 1,
  created_by           BIGINT        NULL,
  updated_by           BIGINT        NULL,
  created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_dept   FOREIGN KEY (department_id) REFERENCES departments(id),
  CONSTRAINT chk_doc_limit CHECK (daily_limit BETWEEN 1 AND 200),
  CONSTRAINT chk_doc_fee   CHECK (consultation_fee >= 0),
  CONSTRAINT chk_doc_exp   CHECK (experience_years BETWEEN 0 AND 70),
  INDEX idx_doc_dept (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE doctor_availability (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  doctor_id    BIGINT     NOT NULL,
  day_of_week  TINYINT    NOT NULL,      -- 1 = Monday ... 7 = Sunday
  start_time   TIME       NOT NULL,
  end_time     TIME       NOT NULL,
  created_by   BIGINT     NULL,
  created_at   DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_da_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  CONSTRAINT chk_da_day  CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT chk_da_time CHECK (end_time > start_time),
  UNIQUE KEY uq_da_doctor_day (doctor_id, day_of_week)   -- one window per day
) ENGINE=InnoDB;

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
