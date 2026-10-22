CREATE DATABASE IF NOT EXISTS pup_intrack;
USE pup_intrack;

CREATE TABLE IF NOT EXISTS app_state (
  state_key VARCHAR(80) PRIMARY KEY,
  state_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  state_key VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS privacy_consents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_identifier VARCHAR(160) NOT NULL,
  account_role ENUM('student', 'adviser', 'coordinator') NOT NULL,
  notice_version VARCHAR(40) NOT NULL,
  accepted_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_privacy_consent (account_identifier, account_role, notice_version)
);

CREATE TABLE IF NOT EXISTS authorized_students (
  student_number VARCHAR(30) PRIMARY KEY,
  pup_webmail VARCHAR(160) NOT NULL UNIQUE,
  last_name VARCHAR(80) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NULL,
  program VARCHAR(30) NOT NULL,
  year_section VARCHAR(30) NOT NULL,
  account_status ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  activated BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  password_changed BOOLEAN NOT NULL DEFAULT FALSE,
  failed_otp_attempts INT NOT NULL DEFAULT 0,
  lockout_until DATETIME NULL,
  otp_request_timestamps JSON NOT NULL DEFAULT (JSON_ARRAY()),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO app_state (state_key, state_json)
VALUES
  ('ojt', JSON_OBJECT()),
  ('auth', JSON_OBJECT())
ON DUPLICATE KEY UPDATE state_key = VALUES(state_key);

INSERT INTO authorized_students (
  student_number,
  pup_webmail,
  last_name,
  first_name,
  middle_name,
  program,
  year_section,
  account_status,
  activated,
  email_verified,
  password_changed,
  failed_otp_attempts,
  lockout_until
)
VALUES
  ('2024-00538-PQ-1', 'kateheartvaguilon@iskolarngbayan.pup.edu.ph', 'Aguilon', 'Kate Heart', NULL, 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00201-PQ-0', 'farhanasalim@iskolarngbayan.pup.edu.ph', 'Alim', 'Farhana', 'Sumandal', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00220-PQ-0', 'marionoliviercatok@iskolarngbayan.pup.edu.ph', 'Atok', 'Marion Olivier', 'Cobo', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00087-PQ-0', 'kimvherlyhbaaco@iskolarngbayan.pup.edu.ph', 'Baaco', 'Kimvherly', NULL, 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00304-PQ-0', 'jessyrosslbagsic@iskolarngbayan.pup.edu.ph', 'Bagsic', 'Jessy Ross', 'Lim', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00144-PQ-0', 'jestinenicolebbaladjay@iskolarngbayan.pup.edu.ph', 'Baladjay', 'Jestine Nicole', 'Bellales', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2024-00540-PQ-1', 'ariannegracielleibandojo@iskolarngbayan.pup.edu.ph', 'Bandojo', 'Arianne Gracielle', 'Intila', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00098-PQ-0', 'asshleyshaneabartolay@iskolarngbayan.pup.edu.ph', 'Bartolay', 'Asshley Shane', 'Ancheta', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00047-PQ-0', 'alexsasbo@iskolarngbayan.pup.edu.ph', 'Bo', 'Alexsa', 'Salvacion', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00162-PQ-0', 'jerickasbuenaflor@iskolarngbayan.pup.edu.ph', 'Buenaflor', 'Jericka', 'Sta. Ana', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00212-PQ-0', 'majillianlcasas@iskolarngbayan.pup.edu.ph', 'Casas', 'Ma. Jillian', 'Langrio', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00312-PQ-0', 'riccajanedcordis@iskolarngbayan.pup.edu.ph', 'Cordis', 'Ricca Jane', 'Delloro', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00153-PQ-0', 'janecristalcdelatorre@iskolarngbayan.pup.edu.ph', 'Dela Torre', 'Jane Cristal', 'Candido', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2024-00525-PQ-1', 'jedallengdelovino@iskolarngbayan.pup.edu.ph', 'Delovino', 'Jed Allen', 'Grageda', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00294-PQ-0', 'khristianpaulqdera@iskolarngbayan.pup.edu.ph', 'Dera', 'Khristian Paul', 'Quebec', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00262-PQ-0', 'josealfonsotdometita@iskolarngbayan.pup.edu.ph', 'Dometita', 'Jose Alfonso', 'Tiongco', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00081-PQ-0', 'carljoshualerlano@iskolarngbayan.pup.edu.ph', 'Erlano', 'Carl Joshua', 'Legaspi', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00186-PQ-0', 'shehannaafenis@iskolarngbayan.pup.edu.ph', 'Fenis', 'Shehanna', 'Alvior', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2024-00565-PQ-1', 'pauleenjoyafernando@iskolarngbayan.pup.edu.ph', 'Fernando', 'Pauleen Joy', 'Angeles', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00249-PQ-0', 'johnraextertgalano@iskolarngbayan.pup.edu.ph', 'Galano', 'John Raexter', 'Tero', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00244-PQ-0', 'marklorencejgalvadores@iskolarngbayan.pup.edu.ph', 'Galvadores', 'Mark Lorence', 'Jabal', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00062-PQ-0', 'jhiankgarcia@iskolarngbayan.pup.edu.ph', 'Garcia', 'Jhian', NULL, 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2024-00546-PQ-1', 'amiraogolbe@iskolarngbayan.pup.edu.ph', 'Golbe', 'Amira', NULL, 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00075-PQ-0', 'jahjahbgonzaga@iskolarngbayan.pup.edu.ph', 'Gonzaga', 'Jah Jah', 'Bajar', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00119-PQ-0', 'agbugonzales@iskolarngbayan.pup.edu.ph', 'Gonzales', 'Ag', 'Burlaza', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00006-PQ-0', 'erikawendydgualberto@iskolarngbayan.pup.edu.ph', 'Gualberto', 'Erika Wendy', 'De Guzman', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00226-PQ-0', 'jonerickjamesvimperial@iskolarngbayan.pup.edu.ph', 'Imperial', 'Jonerick James', 'Vargas', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2024-00547-PQ-1', 'cheriemaerlagon@iskolarngbayan.pup.edu.ph', 'Lagon', 'Cherie Mae', NULL, 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00296-PQ-0', 'joshuadloyola@iskolarngbayan.pup.edu.ph', 'Loyola', 'Joshua', 'Dapat', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00325-PQ-0', 'shariemhaesmallari@iskolarngbayan.pup.edu.ph', 'Mallari', 'Sharie Mhae', 'Sayas', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00150-PQ-0', 'johncharlesamalupa@iskolarngbayan.pup.edu.ph', 'Malupa', 'John Charles', 'Alferez', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00003-PQ-0', 'stephanieviannemmaningo@iskolarngbayan.pup.edu.ph', 'Maningo', 'Stephanie Vianne', 'Mayordomo', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00007-PQ-0', 'jairarmasarate@iskolarngbayan.pup.edu.ph', 'Masarate', 'Jaira', 'Rapanut', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00182-PQ-0', 'valerinesmelgar@iskolarngbayan.pup.edu.ph', 'Melgar', 'Valerine', 'Sebuyo', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00005-PQ-0', 'akiramariepmendoza@iskolarngbayan.pup.edu.ph', 'Mendoza', 'Akira Marie', 'Peregrino', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00114-PQ-0', 'duzcriztianrmiranda@iskolarngbayan.pup.edu.ph', 'Miranda', 'Duz Criztian', 'Ramos', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00288-PQ-0', 'johnaarongmorillo@iskolarngbayan.pup.edu.ph', 'Morillo', 'John Aaron', 'Galatiera', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00324-PQ-0', 'danilenebnazarrea@iskolarngbayan.pup.edu.ph', 'Nazarrea', 'Danilene', 'Bencito', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00012-PQ-0', 'markjovendneri@iskolarngbayan.pup.edu.ph', 'Neri', 'Mark Joven', 'Demolar', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2024-00537-PQ-1', 'judelbnocidal@iskolarngbayan.pup.edu.ph', 'Nocidal', 'Judel', 'Bas', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00091-PQ-0', 'jamesmatthewlobra@iskolarngbayan.pup.edu.ph', 'Obra', 'James Matthew', 'Laudiza', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00008-PQ-0', 'faithrpacis@iskolarngbayan.pup.edu.ph', 'Pacis', 'Faith', 'Rosales', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00276-PQ-0', 'aljhoncpenserga@iskolarngbayan.pup.edu.ph', 'Penserga', 'Aljhon', 'Cantonjos', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2024-00549-PQ-1', 'nickojhontputis@iskolarngbayan.pup.edu.ph', 'Putis', 'Nicko Jhon', 'Tayum', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00247-PQ-0', 'noriellebrarugal@iskolarngbayan.pup.edu.ph', 'Rarugal', 'Norielle', 'Bunggay', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2024-00550-PQ-1', 'danicarrelagio@iskolarngbayan.pup.edu.ph', 'Relagio', 'Danica', NULL, 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00056-PQ-0', 'lesterjohnmrodil@iskolarngbayan.pup.edu.ph', 'Rodil', 'Lester John', 'Marquez', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00001-PQ-0', 'rommelrronquillo@iskolarngbayan.pup.edu.ph', 'Ronquillo', 'Rommel', 'Romuga', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00070-PQ-0', 'ivanvsalazar@iskolarngbayan.pup.edu.ph', 'Salazar', 'Ivan', 'Villanueva', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00133-PQ-0', 'gillianallanssardon@iskolarngbayan.pup.edu.ph', 'Sardon', 'Gillian Allan', 'Sibua', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00127-PQ-0', 'dyriljustinasiervo@iskolarngbayan.pup.edu.ph', 'Siervo', 'Dyril Justin', 'Amonelo', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00136-PQ-0', 'trinamaeasoriano@iskolarngbayan.pup.edu.ph', 'Soriano', 'Trina Mae', 'Alquero', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2024-00564-PQ-1', 'kylatriciactalampas@iskolarngbayan.pup.edu.ph', 'Talampas', 'Kyla Tricia', 'Carrillo', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00004-PQ-0', 'ellisejamesbtamayo@iskolarngbayan.pup.edu.ph', 'Tamayo', 'Ellise James', 'Bulaong', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00170-PQ-0', 'yukalheyrtaruc@iskolarngbayan.pup.edu.ph', 'Taruc', 'Yukalhey', 'Ramos', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00173-PQ-0', 'erickchristiantobias@iskolarngbayan.pup.edu.ph', 'Tobias', 'Erick Christian', NULL, 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00109-PQ-0', 'erikkamaeyptuaya@iskolarngbayan.pup.edu.ph', 'Tuaya', 'Erikka Maey', 'Palomar', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2024-00552-PQ-1', 'argbvaldez@iskolarngbayan.pup.edu.ph', 'Valdez', 'Arg', NULL, 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00142-PQ-0', 'marydianevaliente@iskolarngbayan.pup.edu.ph', 'Valiente', 'Mary Diane', NULL, 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL),
  ('2023-00298-PQ-0', 'sebastiangvillarosa@iskolarngbayan.pup.edu.ph', 'Villarosa', 'Sebastian', 'Guevarra', 'BSIT', '3-1', 'ACTIVE', FALSE, FALSE, FALSE, 0, NULL)
ON DUPLICATE KEY UPDATE
  pup_webmail = VALUES(pup_webmail),
  last_name = VALUES(last_name),
  first_name = VALUES(first_name),
  middle_name = VALUES(middle_name),
  program = VALUES(program),
  year_section = VALUES(year_section),
  account_status = VALUES(account_status);
