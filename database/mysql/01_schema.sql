-- =====================================================================
-- Project Ark : Endangered Species Conservation & Rescue Management
-- MySQL 8.0+ schema (structured/relational part of the hybrid design)
-- Unstructured data (field reports, camera traps, journals) -> MongoDB
-- =====================================================================

DROP DATABASE IF EXISTS project_ark;
CREATE DATABASE project_ark CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE project_ark;

-- ---------------------------------------------------------------------
-- 1. USERS & ROLES
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id        INT AUTO_INCREMENT PRIMARY KEY,
    full_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(120) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,              -- bcrypt hash from Next.js
    role           ENUM('ADMIN','FOREST_OFFICER','RESEARCHER','VET_OFFICER') NOT NULL,
    phone          VARCHAR(15),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_email CHECK (email LIKE '%_@_%._%')
);

-- ---------------------------------------------------------------------
-- 2. SPECIES & PROTECTED AREAS
-- ---------------------------------------------------------------------
CREATE TABLE species (
    species_id          INT AUTO_INCREMENT PRIMARY KEY,
    common_name         VARCHAR(100) NOT NULL,
    scientific_name     VARCHAR(150) NOT NULL UNIQUE,
    category            ENUM('MAMMAL','BIRD','REPTILE','AMPHIBIAN','FISH','INVERTEBRATE') NOT NULL,
    conservation_status ENUM('LC','NT','VU','EN','CR','EW','EX') NOT NULL,  -- IUCN codes
    estimated_population INT CHECK (estimated_population >= 0),
    description         TEXT,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE protected_areas (
    area_id      INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(120) NOT NULL UNIQUE,
    area_type    ENUM('NATIONAL_PARK','SANCTUARY','TIGER_RESERVE','BIOSPHERE_RESERVE','COMMUNITY_RESERVE') NOT NULL,
    state        VARCHAR(60) NOT NULL,
    area_sq_km   DECIMAL(10,2) CHECK (area_sq_km > 0),
    established_year YEAR
);

-- M:N  species <-> protected area (distribution)
CREATE TABLE species_distribution (
    species_id      INT,
    area_id         INT,
    population_count INT NOT NULL DEFAULT 0 CHECK (population_count >= 0),
    last_census     DATE,
    PRIMARY KEY (species_id, area_id),
    FOREIGN KEY (species_id) REFERENCES species(species_id) ON DELETE CASCADE,
    FOREIGN KEY (area_id)    REFERENCES protected_areas(area_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 3. PEOPLE IN THE FIELD
-- ---------------------------------------------------------------------
CREATE TABLE rangers (
    ranger_id   INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNIQUE,                       -- optional login account
    full_name   VARCHAR(100) NOT NULL,
    rank_title  VARCHAR(50),
    area_id     INT,
    phone       VARCHAR(15),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (area_id) REFERENCES protected_areas(area_id) ON DELETE SET NULL
);

CREATE TABLE veterinary_centers (
    center_id   INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    location    VARCHAR(150) NOT NULL,
    capacity    INT NOT NULL CHECK (capacity > 0),
    contact     VARCHAR(15)
);

CREATE TABLE rescue_teams (
    team_id     INT AUTO_INCREMENT PRIMARY KEY,
    team_name   VARCHAR(80) NOT NULL UNIQUE,
    base_area_id INT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (base_area_id) REFERENCES protected_areas(area_id) ON DELETE SET NULL
);

CREATE TABLE team_members (
    team_id    INT,
    ranger_id  INT,
    role_in_team VARCHAR(40) DEFAULT 'MEMBER',
    PRIMARY KEY (team_id, ranger_id),
    FOREIGN KEY (team_id)   REFERENCES rescue_teams(team_id) ON DELETE CASCADE,
    FOREIGN KEY (ranger_id) REFERENCES rangers(ranger_id)    ON DELETE CASCADE
);

CREATE TABLE patrol_assignments (
    patrol_id   INT AUTO_INCREMENT PRIMARY KEY,
    ranger_id   INT NOT NULL,
    area_id     INT NOT NULL,
    patrol_date DATE NOT NULL,
    shift       ENUM('MORNING','EVENING','NIGHT') NOT NULL,
    remarks     VARCHAR(255),
    UNIQUE (ranger_id, patrol_date, shift),           -- no double booking
    FOREIGN KEY (ranger_id) REFERENCES rangers(ranger_id) ON DELETE CASCADE,
    FOREIGN KEY (area_id)   REFERENCES protected_areas(area_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 4. ANIMALS, SIGHTINGS, RESCUES
-- ---------------------------------------------------------------------
CREATE TABLE animals (
    animal_id    INT AUTO_INCREMENT PRIMARY KEY,
    species_id   INT NOT NULL,
    tag_code     VARCHAR(30) UNIQUE,
    sex          ENUM('M','F','UNKNOWN') DEFAULT 'UNKNOWN',
    est_age_years DECIMAL(4,1),
    center_id    INT,                                 -- current vet center, if any
    status       ENUM('WILD','IN_RESCUE','UNDER_TREATMENT','REHABILITATING','RELEASED','DECEASED')
                 NOT NULL DEFAULT 'WILD',
    release_approved_by INT,                          -- vet officer user_id
    FOREIGN KEY (species_id) REFERENCES species(species_id),
    FOREIGN KEY (center_id)  REFERENCES veterinary_centers(center_id) ON DELETE SET NULL,
    FOREIGN KEY (release_approved_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE sightings (
    sighting_id  INT AUTO_INCREMENT PRIMARY KEY,
    species_id   INT NOT NULL,
    area_id      INT NOT NULL,
    reported_by  INT NOT NULL,
    latitude     DECIMAL(9,6) NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
    longitude    DECIMAL(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    sighted_at   DATETIME NOT NULL,
    count_seen   INT NOT NULL DEFAULT 1 CHECK (count_seen > 0),
    is_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by  INT,
    mongo_report_id CHAR(24),                         -- link to MongoDB field report / photos
    FOREIGN KEY (species_id)  REFERENCES species(species_id),
    FOREIGN KEY (area_id)     REFERENCES protected_areas(area_id),
    FOREIGN KEY (reported_by) REFERENCES users(user_id),
    FOREIGN KEY (verified_by) REFERENCES users(user_id)
);

CREATE TABLE rescue_operations (
    rescue_id    INT AUTO_INCREMENT PRIMARY KEY,
    animal_id    INT,
    species_id   INT NOT NULL,
    area_id      INT NOT NULL,
    reported_by  INT NOT NULL,
    team_id      INT,
    priority     ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    status       ENUM('REPORTED','APPROVED','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')
                 NOT NULL DEFAULT 'REPORTED',
    description  VARCHAR(500),
    reported_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at    TIMESTAMP NULL,
    mongo_doc_id CHAR(24),                            -- rescue documentation in MongoDB
    FOREIGN KEY (animal_id)   REFERENCES animals(animal_id) ON DELETE SET NULL,
    FOREIGN KEY (species_id)  REFERENCES species(species_id),
    FOREIGN KEY (area_id)     REFERENCES protected_areas(area_id),
    FOREIGN KEY (reported_by) REFERENCES users(user_id),
    FOREIGN KEY (team_id)     REFERENCES rescue_teams(team_id) ON DELETE SET NULL,
    CONSTRAINT chk_closed CHECK (closed_at IS NULL OR closed_at >= reported_at)
);

-- History of every status change (filled by trigger)
CREATE TABLE rescue_status_log (
    log_id     INT AUTO_INCREMENT PRIMARY KEY,
    rescue_id  INT NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rescue_id) REFERENCES rescue_operations(rescue_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 5. ANIMAL HEALTH
-- ---------------------------------------------------------------------
CREATE TABLE health_records (
    record_id   INT AUTO_INCREMENT PRIMARY KEY,
    animal_id   INT NOT NULL,
    vet_id      INT NOT NULL,
    exam_date   DATE NOT NULL,
    diagnosis   VARCHAR(255),
    weight_kg   DECIMAL(7,2) CHECK (weight_kg > 0),
    condition_level ENUM('CRITICAL','POOR','STABLE','GOOD','FIT_FOR_RELEASE') NOT NULL,
    FOREIGN KEY (animal_id) REFERENCES animals(animal_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id)    REFERENCES users(user_id)
);

CREATE TABLE treatments (
    treatment_id INT AUTO_INCREMENT PRIMARY KEY,
    record_id    INT NOT NULL,
    medication   VARCHAR(120) NOT NULL,
    dosage       VARCHAR(60),
    start_date   DATE NOT NULL,
    end_date     DATE,
    CHECK (end_date IS NULL OR end_date >= start_date),
    FOREIGN KEY (record_id) REFERENCES health_records(record_id) ON DELETE CASCADE
);

CREATE TABLE vaccinations (
    vaccination_id INT AUTO_INCREMENT PRIMARY KEY,
    animal_id      INT NOT NULL,
    vaccine_name   VARCHAR(100) NOT NULL,
    given_on       DATE NOT NULL,
    next_due       DATE,
    FOREIGN KEY (animal_id) REFERENCES animals(animal_id) ON DELETE CASCADE
);

-- Generic audit trail
CREATE TABLE audit_log (
    audit_id   INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id  INT NOT NULL,
    action     VARCHAR(20) NOT NULL,
    details    VARCHAR(255),
    logged_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 6. INDEXES (query performance)
-- ---------------------------------------------------------------------
CREATE INDEX idx_species_status   ON species(conservation_status);
CREATE INDEX idx_sightings_time   ON sightings(sighted_at);
CREATE INDEX idx_sightings_sp_ar  ON sightings(species_id, area_id);
CREATE INDEX idx_rescue_status    ON rescue_operations(status, priority);
CREATE INDEX idx_health_animal    ON health_records(animal_id, exam_date);
CREATE FULLTEXT INDEX ft_species  ON species(common_name, scientific_name, description);

-- ---------------------------------------------------------------------
-- 7. TRIGGERS
-- ---------------------------------------------------------------------
DELIMITER $$

-- T1: log every rescue status change + auto-set closed_at + free the team
CREATE TRIGGER trg_rescue_status_change
BEFORE UPDATE ON rescue_operations
FOR EACH ROW
BEGIN
    IF NEW.status <> OLD.status THEN
        INSERT INTO rescue_status_log(rescue_id, old_status, new_status)
        VALUES (OLD.rescue_id, OLD.status, NEW.status);

        IF NEW.status IN ('COMPLETED','CANCELLED') THEN
            SET NEW.closed_at = CURRENT_TIMESTAMP;
            IF NEW.team_id IS NOT NULL THEN
                UPDATE rescue_teams SET is_available = TRUE WHERE team_id = NEW.team_id;
            END IF;
        END IF;
    END IF;
END$$

-- T2: an animal can only be RELEASED if a vet approved it and last exam says FIT_FOR_RELEASE
CREATE TRIGGER trg_check_release
BEFORE UPDATE ON animals
FOR EACH ROW
BEGIN
    DECLARE last_condition VARCHAR(20);
    IF NEW.status = 'RELEASED' AND OLD.status <> 'RELEASED' THEN
        IF NEW.release_approved_by IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Release requires veterinary approval';
        END IF;
        SELECT condition_level INTO last_condition
        FROM health_records WHERE animal_id = NEW.animal_id
        ORDER BY exam_date DESC, record_id DESC LIMIT 1;
        IF last_condition IS NULL OR last_condition <> 'FIT_FOR_RELEASE' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Latest health exam is not FIT_FOR_RELEASE';
        END IF;
        SET NEW.center_id = NULL;
    END IF;
END$$

-- T3: only VET_OFFICER users can create health records
CREATE TRIGGER trg_health_vet_only
BEFORE INSERT ON health_records
FOR EACH ROW
BEGIN
    IF (SELECT role FROM users WHERE user_id = NEW.vet_id) <> 'VET_OFFICER' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only veterinary officers can add health records';
    END IF;
END$$

-- T4: audit conservation-status changes
CREATE TRIGGER trg_species_audit
AFTER UPDATE ON species
FOR EACH ROW
BEGIN
    IF NEW.conservation_status <> OLD.conservation_status THEN
        INSERT INTO audit_log(table_name, record_id, action, details)
        VALUES ('species', NEW.species_id, 'STATUS_CHANGE',
                CONCAT(OLD.conservation_status, ' -> ', NEW.conservation_status));
    END IF;
END$$

-- T5: vet-center capacity check when an animal is admitted
CREATE TRIGGER trg_center_capacity
BEFORE UPDATE ON animals
FOR EACH ROW
BEGIN
    DECLARE occupied INT; DECLARE cap INT;
    IF NEW.center_id IS NOT NULL AND (OLD.center_id IS NULL OR NEW.center_id <> OLD.center_id) THEN
        SELECT COUNT(*) INTO occupied FROM animals
        WHERE center_id = NEW.center_id AND status IN ('UNDER_TREATMENT','REHABILITATING');
        SELECT capacity INTO cap FROM veterinary_centers WHERE center_id = NEW.center_id;
        IF occupied >= cap THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Veterinary center is at full capacity';
        END IF;
    END IF;
END$$

-- ---------------------------------------------------------------------
-- 8. STORED PROCEDURES (with transactions)
-- ---------------------------------------------------------------------

-- P1: assign a team to a rescue atomically (row locks prevent double assignment)
CREATE PROCEDURE sp_assign_rescue_team(IN p_rescue_id INT, IN p_team_id INT)
BEGIN
    DECLARE v_available BOOLEAN; DECLARE v_status VARCHAR(20);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;
    SELECT is_available INTO v_available FROM rescue_teams WHERE team_id = p_team_id FOR UPDATE;
    SELECT status INTO v_status FROM rescue_operations WHERE rescue_id = p_rescue_id FOR UPDATE;

    IF v_available IS NULL OR v_available = FALSE THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Team not available';
    END IF;
    IF v_status <> 'APPROVED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rescue must be APPROVED before assignment';
    END IF;

    UPDATE rescue_operations SET team_id = p_team_id, status = 'ASSIGNED' WHERE rescue_id = p_rescue_id;
    UPDATE rescue_teams SET is_available = FALSE WHERE team_id = p_team_id;
    COMMIT;
END$$

-- P2: close a rescue and admit the animal to a vet center in one transaction
CREATE PROCEDURE sp_close_rescue(IN p_rescue_id INT, IN p_center_id INT)
BEGIN
    DECLARE v_animal INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;
    SELECT animal_id INTO v_animal FROM rescue_operations WHERE rescue_id = p_rescue_id FOR UPDATE;
    UPDATE rescue_operations SET status = 'COMPLETED' WHERE rescue_id = p_rescue_id;
    IF v_animal IS NOT NULL AND p_center_id IS NOT NULL THEN
        UPDATE animals SET center_id = p_center_id, status = 'UNDER_TREATMENT' WHERE animal_id = v_animal;
    END IF;
    COMMIT;
END$$

-- P3: species report for one protected area
CREATE PROCEDURE sp_area_species_report(IN p_area_id INT)
BEGIN
    SELECT s.common_name, s.conservation_status, d.population_count, d.last_census,
           (SELECT COUNT(*) FROM sightings g
             WHERE g.species_id = s.species_id AND g.area_id = p_area_id
               AND g.sighted_at >= NOW() - INTERVAL 90 DAY) AS sightings_last_90d
    FROM species_distribution d JOIN species s ON s.species_id = d.species_id
    WHERE d.area_id = p_area_id
    ORDER BY FIELD(s.conservation_status,'CR','EN','VU','NT','LC');
END$$

-- ---------------------------------------------------------------------
-- 9. FUNCTION
-- ---------------------------------------------------------------------
-- F1: average rescue resolution time (hours) for an area
CREATE FUNCTION fn_avg_rescue_hours(p_area_id INT)
RETURNS DECIMAL(10,2)
READS SQL DATA
BEGIN
    DECLARE v DECIMAL(10,2);
    SELECT AVG(TIMESTAMPDIFF(MINUTE, reported_at, closed_at)) / 60 INTO v
    FROM rescue_operations WHERE area_id = p_area_id AND status = 'COMPLETED';
    RETURN IFNULL(v, 0);
END$$

DELIMITER ;

-- ---------------------------------------------------------------------
-- 10. VIEWS (analytics dashboard)
-- ---------------------------------------------------------------------
CREATE VIEW v_rescue_stats AS
SELECT pa.name AS area, r.status, r.priority, COUNT(*) AS total
FROM rescue_operations r JOIN protected_areas pa ON pa.area_id = r.area_id
GROUP BY pa.name, r.status, r.priority;

CREATE VIEW v_species_population AS
SELECT s.species_id, s.common_name, s.conservation_status,
       COALESCE(SUM(d.population_count),0) AS total_population,
       COUNT(d.area_id)         AS areas_present
FROM species s LEFT JOIN species_distribution d ON d.species_id = s.species_id
GROUP BY s.species_id, s.common_name, s.conservation_status;

CREATE VIEW v_monthly_sightings AS
SELECT DATE_FORMAT(sighted_at, '%Y-%m') AS month, species_id, area_id,
       COUNT(*) AS reports, SUM(count_seen) AS individuals
FROM sightings WHERE is_verified = TRUE
GROUP BY month, species_id, area_id;

CREATE VIEW v_animals_in_care AS
SELECT a.animal_id, a.tag_code, s.common_name, vc.name AS center, a.status,
       (SELECT condition_level FROM health_records h WHERE h.animal_id = a.animal_id
        ORDER BY exam_date DESC, record_id DESC LIMIT 1) AS latest_condition
FROM animals a
JOIN species s ON s.species_id = a.species_id
LEFT JOIN veterinary_centers vc ON vc.center_id = a.center_id
WHERE a.status IN ('IN_RESCUE','UNDER_TREATMENT','REHABILITATING');

-- Window function example: rank species by sightings within each area
CREATE VIEW v_top_species_per_area AS
SELECT * FROM (
    SELECT area_id, species_id, COUNT(*) AS sightings,
           RANK() OVER (PARTITION BY area_id ORDER BY COUNT(*) DESC) AS rnk
    FROM sightings GROUP BY area_id, species_id
) t WHERE rnk <= 5;

-- ---------------------------------------------------------------------
-- 11. SAMPLE DATA
-- ---------------------------------------------------------------------
INSERT INTO users(full_name,email,password_hash,role) VALUES
('Admin Ark','admin@ark.org','$2b$10$qZrR5Jtq0w8DrEkjbTYUSuHdlTcMX5bxibPzH/Hl6fAcjuDfoytRO','ADMIN'),
('Ravi Kumar','ravi@forest.gov.in','$2b$10$qZrR5Jtq0w8DrEkjbTYUSuHdlTcMX5bxibPzH/Hl6fAcjuDfoytRO','FOREST_OFFICER'),
('Meera Rao','meera@research.org','$2b$10$qZrR5Jtq0w8DrEkjbTYUSuHdlTcMX5bxibPzH/Hl6fAcjuDfoytRO','RESEARCHER'),
('Dr. Anil Shetty','anil@vet.org','$2b$10$qZrR5Jtq0w8DrEkjbTYUSuHdlTcMX5bxibPzH/Hl6fAcjuDfoytRO','VET_OFFICER');

INSERT INTO species(common_name,scientific_name,category,conservation_status,estimated_population) VALUES
('Bengal Tiger','Panthera tigris tigris','MAMMAL','EN',3682),
('Asian Elephant','Elephas maximus','MAMMAL','EN',27000),
('Great Indian Bustard','Ardeotis nigriceps','BIRD','CR',150),
('Gharial','Gavialis gangeticus','REPTILE','CR',650),
('Lion-tailed Macaque','Macaca silenus','MAMMAL','EN',4200);

INSERT INTO protected_areas(name,area_type,state,area_sq_km,established_year) VALUES
('Bandipur National Park','TIGER_RESERVE','Karnataka',912.04,1974),
('Nagarhole National Park','NATIONAL_PARK','Karnataka',643.39,1988),
('Desert National Park','NATIONAL_PARK','Rajasthan',3162.00,1992);

INSERT INTO species_distribution VALUES
(1,1,191,'2024-01-15'),(2,1,1200,'2024-01-15'),(1,2,141,'2024-01-15'),
(5,2,80,'2023-11-01'),(3,3,40,'2024-03-10');

INSERT INTO veterinary_centers(name,location,capacity,contact) VALUES
('Bannerghatta Rescue Centre','Bengaluru',25,'0801234567'),
('Mysuru Zoo Hospital','Mysuru',15,'0821765432');

INSERT INTO rangers(user_id,full_name,rank_title,area_id) VALUES
(2,'Ravi Kumar','RFO',1),(NULL,'Suresh Gowda','Forest Guard',1),(NULL,'Lakshmi N','Forest Guard',2);

INSERT INTO rescue_teams(team_name,base_area_id) VALUES ('Bandipur Alpha',1),('Nagarhole Bravo',2);
INSERT INTO team_members VALUES (1,1,'LEAD'),(1,2,'MEMBER'),(2,3,'LEAD');

INSERT INTO animals(species_id,tag_code,sex,est_age_years,status) VALUES
(1,'BNP-T-017','M',6,'IN_RESCUE'),(2,'BNP-E-104','F',12,'WILD');

INSERT INTO sightings(species_id,area_id,reported_by,latitude,longitude,sighted_at,count_seen,is_verified,verified_by) VALUES
(1,1,2,11.6670,76.6320,'2026-08-12 06:40:00',1,TRUE,1),
(2,1,2,11.6801,76.6105,'2026-08-14 17:10:00',7,TRUE,1),
(5,2,3,12.0021,76.1203,'2026-09-02 08:05:00',3,FALSE,NULL);

INSERT INTO rescue_operations(animal_id,species_id,area_id,reported_by,priority,status,description) VALUES
(1,1,1,2,'CRITICAL','APPROVED','Tiger with snare injury on right foreleg near Moolehole range');

-- Demo calls:
-- CALL sp_assign_rescue_team(1, 1);
-- CALL sp_close_rescue(1, 1);
-- CALL sp_area_species_report(1);
-- SELECT fn_avg_rescue_hours(1);
-- SELECT * FROM rescue_status_log;
