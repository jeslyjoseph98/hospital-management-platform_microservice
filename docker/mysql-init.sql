-- Stack A databases (user-service, doctor-service)
CREATE DATABASE IF NOT EXISTS hms_user CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS hms_doctor CHARACTER SET utf8mb4;

CREATE USER IF NOT EXISTS 'user_service'@'%' IDENTIFIED BY 'user_service_pw';
GRANT ALL PRIVILEGES ON hms_user.* TO 'user_service'@'%';

CREATE USER IF NOT EXISTS 'doctor_service'@'%' IDENTIFIED BY 'doctor_service_pw';
GRANT ALL PRIVILEGES ON hms_doctor.* TO 'doctor_service'@'%';

FLUSH PRIVILEGES;
