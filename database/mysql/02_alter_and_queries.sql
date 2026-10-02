-- =====================================================================
-- Project Ark : ALTER statements + important DML / queries
-- Run AFTER 01_schema.sql
-- =====================================================================
USE project_ark;
SET SQL_SAFE_UPDATES = 0;   -- Workbench blocks DELETE without a key column otherwise

-- ---------------------------------------------------------------------
-- A. ALTER (schema evolution)
-- ---------------------------------------------------------------------
ALTER TABLE species ADD COLUMN habitat_type VARCHAR(80) AFTER category;
ALTER TABLE rescue_teams ADD COLUMN vehicle_no VARCHAR(20);
ALTER TABLE rescue_teams ADD CONSTRAINT uq_vehicle UNIQUE (vehicle_no);
ALTER TABLE veterinary_centers MODIFY contact VARCHAR(20);
ALTER TABLE rangers ADD INDEX idx_ranger_area (area_id);

UPDATE species SET habitat_type = 'Tropical dry forest' WHERE species_id IN (1,2);
UPDATE species SET habitat_type = 'Grassland'          WHERE species_id = 3;
UPDATE species SET habitat_type = 'River'              WHERE species_id = 4;
UPDATE species SET habitat_type = 'Evergreen forest'   WHERE species_id = 5;

-- DROP demo (temporary table created and dropped)
CREATE TABLE tmp_import (id INT PRIMARY KEY, note VARCHAR(50));
DROP TABLE tmp_import;

-- ---------------------------------------------------------------------
-- B. Extra sample data for richer queries
-- ---------------------------------------------------------------------
INSERT INTO sightings(species_id,area_id,reported_by,latitude,longitude,sighted_at,count_seen,is_verified,verified_by) VALUES
(1,1,2,11.6600,76.6400,'2026-07-03 05:50:00',2,TRUE,1),
(1,2,2,12.0100,76.1500,'2026-07-21 18:30:00',1,TRUE,1),
(2,2,2,12.0300,76.1000,'2026-08-25 16:00:00',12,TRUE,1),
(3,3,3,26.9000,70.9000,'2026-09-10 07:20:00',4,TRUE,1),
(2,1,2,11.7000,76.6000,'2026-09-15 17:45:00',5,FALSE,NULL);

INSERT INTO patrol_assignments(ranger_id,area_id,patrol_date,shift,remarks) VALUES
(1,1,'2026-09-28','MORNING','Moolehole range'),(2,1,'2026-09-28','NIGHT','Anti-poaching'),
(3,2,'2026-09-29','EVENING','Kabini backwaters');

-- ---------------------------------------------------------------------
-- C. DML examples
-- ---------------------------------------------------------------------
UPDATE sightings SET is_verified = TRUE, verified_by = 1 WHERE sighting_id = 3;
DELETE FROM sightings WHERE is_verified = FALSE AND sighted_at < NOW() - INTERVAL 365 DAY;

-- ---------------------------------------------------------------------
-- D. Important queries
-- ---------------------------------------------------------------------
-- Q1 JOIN (4 tables): verified sightings with species, area and reporter
SELECT g.sighting_id, s.common_name, pa.name AS area, u.full_name AS reported_by, g.sighted_at, g.count_seen
FROM sightings g
JOIN species s          ON s.species_id = g.species_id
JOIN protected_areas pa ON pa.area_id   = g.area_id
JOIN users u            ON u.user_id    = g.reported_by
WHERE g.is_verified = TRUE
ORDER BY g.sighted_at DESC;

-- Q2 GROUP BY + HAVING: areas with more than 1 verified sighting
SELECT pa.name, COUNT(*) AS sightings, SUM(g.count_seen) AS individuals
FROM sightings g JOIN protected_areas pa ON pa.area_id = g.area_id
WHERE g.is_verified = TRUE
GROUP BY pa.name
HAVING COUNT(*) > 1
ORDER BY sightings DESC;

-- Q3 Subquery: critically endangered species never sighted in the last 90 days
SELECT common_name, conservation_status FROM species
WHERE conservation_status = 'CR'
  AND species_id NOT IN (SELECT species_id FROM sightings WHERE sighted_at >= NOW() - INTERVAL 90 DAY);

-- Q4 Correlated subquery: areas whose tiger population is above the average tiger population
SELECT pa.name, d.population_count FROM species_distribution d
JOIN protected_areas pa ON pa.area_id = d.area_id
WHERE d.species_id = 1
  AND d.population_count > (SELECT AVG(d2.population_count) FROM species_distribution d2 WHERE d2.species_id = d.species_id);

-- Q5 LEFT JOIN + aggregate: rescue workload per team (teams with 0 included)
SELECT t.team_name, COUNT(r.rescue_id) AS rescues,
       SUM(r.status = 'COMPLETED') AS completed
FROM rescue_teams t LEFT JOIN rescue_operations r ON r.team_id = t.team_id
GROUP BY t.team_id, t.team_name;

-- Q6 EXISTS: rangers who are in a team AND have a patrol this week
SELECT r.full_name FROM rangers r
WHERE EXISTS (SELECT 1 FROM team_members m WHERE m.ranger_id = r.ranger_id)
  AND EXISTS (SELECT 1 FROM patrol_assignments p WHERE p.ranger_id = r.ranger_id
              AND p.patrol_date >= CURDATE() - INTERVAL 7 DAY);

-- Q7 Full-text search on species
SELECT common_name, scientific_name,
       MATCH(common_name, scientific_name, description) AGAINST ('tiger' IN NATURAL LANGUAGE MODE) AS score
FROM species
WHERE MATCH(common_name, scientific_name, description) AGAINST ('tiger' IN NATURAL LANGUAGE MODE);

-- Q8 CTE + window function: monthly sightings with running total
WITH m AS (
  SELECT DATE_FORMAT(sighted_at,'%Y-%m') AS month, COUNT(*) AS c
  FROM sightings GROUP BY month
)
SELECT month, c, SUM(c) OVER (ORDER BY month) AS running_total FROM m;

-- Q9 Views / procedure / function usage
SELECT * FROM v_species_population ORDER BY total_population DESC;
SELECT * FROM v_top_species_per_area;
CALL sp_area_species_report(1);
SELECT name, fn_avg_rescue_hours(area_id) AS avg_hours FROM protected_areas;

-- Q10 EXPLAIN to show index use
EXPLAIN SELECT * FROM rescue_operations WHERE status = 'APPROVED' AND priority = 'CRITICAL';
