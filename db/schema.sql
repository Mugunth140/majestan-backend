CREATE TABLE IF NOT EXISTS login (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin') NOT NULL DEFAULT 'admin',
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blogs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NULL,
  image VARCHAR(500) NULL,
  content LONGTEXT NULL,
  views INT NOT NULL DEFAULT 0,
  likes INT NOT NULL DEFAULT 0,
  meta_title VARCHAR(255) NULL,
  meta_description TEXT NULL,
  meta_keywords TEXT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_blogs_status (status),
  UNIQUE KEY uq_blogs_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wishlist (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(64) NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL,
  property_type VARCHAR(100) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wishlist_user_property (user_id, property_id, property_type),
  INDEX idx_wishlist_user (user_id),
  INDEX idx_wishlist_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sublocations (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  sublocation VARCHAR(191) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sublocations_name (sublocation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS unittypes (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  unittype VARCHAR(191) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_unittypes_name (unittype)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ageproperties (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  date VARCHAR(255) NULL,
  ageproperty VARCHAR(255) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ageproperties_status (status),
  UNIQUE KEY uq_ageproperties_name (ageproperty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facing_directions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  date VARCHAR(255) NULL,
  facing VARCHAR(255) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_facing_directions_status (status),
  UNIQUE KEY uq_facing_directions_name (facing)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS floors (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  date VARCHAR(255) NULL,
  floor VARCHAR(255) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_floors_status (status),
  UNIQUE KEY uq_floors_name (floor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS furnishings (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  date VARCHAR(255) NULL,
  furnishing VARCHAR(255) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_furnishings_status (status),
  UNIQUE KEY uq_furnishings_name (furnishing)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS propertyuses (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  date VARCHAR(255) NULL,
  propertyuse VARCHAR(255) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_propertyuses_status (status),
  UNIQUE KEY uq_propertyuses_name (propertyuse)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS business_setup (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_name VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  email VARCHAR(255) NULL,
  website VARCHAR(255) NULL,
  logo VARCHAR(500) NULL,
  settings JSON NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS business_profile (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_name VARCHAR(255) NULL,
  address TEXT NULL,
  phone VARCHAR(64) NULL,
  email VARCHAR(255) NULL,
  website VARCHAR(255) NULL,
  about LONGTEXT NULL,
  social JSON NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS banner (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NULL,
  image VARCHAR(500) NULL,
  redirect_url VARCHAR(500) NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enquiry (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(32) NULL,
  propertyid BIGINT UNSIGNED NULL,
  property_type VARCHAR(100) NULL,
  purchase_type VARCHAR(32) NULL,
  listing_type VARCHAR(32) NULL,
  budget VARCHAR(64) NULL,
  message TEXT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_enquiry_status (status),
  INDEX idx_enquiry_property_type (property_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS propertydetails (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(32) NULL,
  property_type VARCHAR(100) NULL,
  listing_type VARCHAR(32) NULL,
  location VARCHAR(255) NULL,
  message TEXT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_propertydetails_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS apartment (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  apartment_code VARCHAR(100) NULL,
  propertyname VARCHAR(255) NULL,
  posttype ENUM('Sell', 'Rent') NOT NULL DEFAULT 'Sell',
  transactiontype VARCHAR(100) NULL,
  expectedsaleprice DECIMAL(15,2) NOT NULL DEFAULT 0,
  monthly_rent DECIMAL(15,2) NOT NULL DEFAULT 0,
  unittype VARCHAR(100) NULL,
  build_up_area DECIMAL(15,2) NOT NULL DEFAULT 0,
  furnishing_status VARCHAR(100) NULL,
  floor VARCHAR(50) NULL,
  facing VARCHAR(50) NULL,
  property_age VARCHAR(100) NULL,
  sublocation VARCHAR(255) NULL,
  booking_status TINYINT NOT NULL DEFAULT 1,
  status TINYINT NOT NULL DEFAULT 1,
  meta_title VARCHAR(255) NULL,
  meta_description TEXT NULL,
  meta_keywords TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_apartment_code (apartment_code),
  INDEX idx_apartment_status (status),
  INDEX idx_apartment_posttype (posttype),
  INDEX idx_apartment_sublocation (sublocation),
  INDEX idx_apartment_floor (floor),
  INDEX idx_apartment_unittype (unittype),
  INDEX idx_apartment_expectedsaleprice (expectedsaleprice),
  INDEX idx_apartment_monthly_rent (monthly_rent),
  INDEX idx_apartment_facing (facing),
  INDEX idx_apartment_property_age (property_age),
  INDEX idx_apartment_booking_status (booking_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS villas (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  villa_code VARCHAR(100) NULL,
  propertyname VARCHAR(255) NULL,
  posttype ENUM('Sell', 'Rent') NOT NULL DEFAULT 'Sell',
  transaction_type VARCHAR(100) NULL,
  expectedsaleprice DECIMAL(15,2) NOT NULL DEFAULT 0,
  monthly_rent DECIMAL(15,2) NOT NULL DEFAULT 0,
  configuration VARCHAR(100) NULL,
  buildup_area DECIMAL(15,2) NOT NULL DEFAULT 0,
  furnishing_status VARCHAR(100) NULL,
  floor VARCHAR(50) NULL,
  facing_direction VARCHAR(50) NULL,
  property_age VARCHAR(100) NULL,
  sublocation VARCHAR(255) NULL,
  booking_status TINYINT NOT NULL DEFAULT 1,
  status TINYINT NOT NULL DEFAULT 1,
  meta_title VARCHAR(255) NULL,
  meta_description TEXT NULL,
  meta_keywords TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_villa_code (villa_code),
  INDEX idx_villas_status (status),
  INDEX idx_villas_posttype (posttype),
  INDEX idx_villas_sublocation (sublocation),
  INDEX idx_villas_floor (floor),
  INDEX idx_villas_configuration (configuration),
  INDEX idx_villas_expectedsaleprice (expectedsaleprice),
  INDEX idx_villas_monthly_rent (monthly_rent),
  INDEX idx_villas_facing_direction (facing_direction),
  INDEX idx_villas_property_age (property_age),
  INDEX idx_villas_booking_status (booking_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS individual_portions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  individual_space_code VARCHAR(100) NULL,
  propertyname VARCHAR(255) NULL,
  posttype ENUM('Sell', 'Rent') NOT NULL DEFAULT 'Sell',
  expectedsaleprice DECIMAL(15,2) NOT NULL DEFAULT 0,
  monthly_rent DECIMAL(15,2) NOT NULL DEFAULT 0,
  configuration VARCHAR(100) NULL,
  plot_area DECIMAL(15,2) NOT NULL DEFAULT 0,
  furnishing_status VARCHAR(100) NULL,
  floor VARCHAR(50) NULL,
  facing VARCHAR(50) NULL,
  property_age VARCHAR(100) NULL,
  sublocation VARCHAR(255) NULL,
  booking_status TINYINT NOT NULL DEFAULT 1,
  status TINYINT NOT NULL DEFAULT 1,
  meta_title VARCHAR(255) NULL,
  meta_description TEXT NULL,
  meta_keywords TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_individual_code (individual_space_code),
  INDEX idx_individual_status (status),
  INDEX idx_individual_posttype (posttype),
  INDEX idx_individual_sublocation (sublocation),
  INDEX idx_individual_floor (floor),
  INDEX idx_individual_configuration (configuration),
  INDEX idx_individual_expectedsaleprice (expectedsaleprice),
  INDEX idx_individual_monthly_rent (monthly_rent),
  INDEX idx_individual_facing (facing),
  INDEX idx_individual_property_age (property_age),
  INDEX idx_individual_booking_status (booking_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plots (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  plot_code VARCHAR(100) NULL,
  propertyname VARCHAR(255) NULL,
  posttype ENUM('Sell', 'Rent') NOT NULL DEFAULT 'Sell',
  expectedsaleprice DECIMAL(15,2) NOT NULL DEFAULT 0,
  monthly_rent DECIMAL(15,2) NOT NULL DEFAULT 0,
  project_area DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_area DECIMAL(15,2) NOT NULL DEFAULT 0,
  facing_direction VARCHAR(50) NULL,
  sublocation VARCHAR(255) NULL,
  booking_status TINYINT NOT NULL DEFAULT 1,
  status TINYINT NOT NULL DEFAULT 1,
  meta_title VARCHAR(255) NULL,
  meta_description TEXT NULL,
  meta_keywords TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_plots_code (plot_code),
  INDEX idx_plots_status (status),
  INDEX idx_plots_posttype (posttype),
  INDEX idx_plots_sublocation (sublocation),
  INDEX idx_plots_facing_direction (facing_direction),
  INDEX idx_plots_project_area (project_area),
  INDEX idx_plots_total_area (total_area),
  INDEX idx_plots_expectedsaleprice (expectedsaleprice),
  INDEX idx_plots_monthly_rent (monthly_rent),
  INDEX idx_plots_booking_status (booking_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS farmlands (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  farm_land_code VARCHAR(100) NULL,
  propertyname VARCHAR(255) NULL,
  posttype ENUM('Sell', 'Rent') NOT NULL DEFAULT 'Sell',
  expectedsaleprice DECIMAL(15,2) NOT NULL DEFAULT 0,
  monthly_rent DECIMAL(15,2) NOT NULL DEFAULT 0,
  totalarea DECIMAL(15,2) NOT NULL DEFAULT 0,
  facing VARCHAR(50) NULL,
  sublocation VARCHAR(255) NULL,
  booking_status TINYINT NOT NULL DEFAULT 1,
  status TINYINT NOT NULL DEFAULT 1,
  meta_title VARCHAR(255) NULL,
  meta_description TEXT NULL,
  meta_keywords TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_farmland_code (farm_land_code),
  INDEX idx_farmlands_status (status),
  INDEX idx_farmlands_posttype (posttype),
  INDEX idx_farmlands_sublocation (sublocation),
  INDEX idx_farmlands_facing (facing),
  INDEX idx_farmlands_totalarea (totalarea),
  INDEX idx_farmlands_expectedsaleprice (expectedsaleprice),
  INDEX idx_farmlands_monthly_rent (monthly_rent),
  INDEX idx_farmlands_booking_status (booking_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS commercial_space (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  common_space_code VARCHAR(100) NULL,
  propertyname VARCHAR(255) NULL,
  posttype ENUM('Sell', 'Rent') NOT NULL DEFAULT 'Sell',
  expectedsaleprice DECIMAL(15,2) NOT NULL DEFAULT 0,
  monthly_rent DECIMAL(15,2) NOT NULL DEFAULT 0,
  unitsize DECIMAL(15,2) NOT NULL DEFAULT 0,
  propertyuse VARCHAR(100) NULL,
  furnishing_status VARCHAR(100) NULL,
  floor VARCHAR(50) NULL,
  facing VARCHAR(50) NULL,
  ageofproperty VARCHAR(100) NULL,
  sublocation VARCHAR(255) NULL,
  booking_status TINYINT NOT NULL DEFAULT 1,
  status TINYINT NOT NULL DEFAULT 1,
  meta_title VARCHAR(255) NULL,
  meta_description TEXT NULL,
  meta_keywords TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_commercial_code (common_space_code),
  INDEX idx_commercial_status (status),
  INDEX idx_commercial_posttype (posttype),
  INDEX idx_commercial_sublocation (sublocation),
  INDEX idx_commercial_floor (floor),
  INDEX idx_commercial_propertyuse (propertyuse),
  INDEX idx_commercial_unitsize (unitsize),
  INDEX idx_commercial_ageofproperty (ageofproperty),
  INDEX idx_commercial_expectedsaleprice (expectedsaleprice),
  INDEX idx_commercial_monthly_rent (monthly_rent),
  INDEX idx_commercial_furnishing_status (furnishing_status),
  INDEX idx_commercial_booking_status (booking_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS industrial_spaces (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  industrial_space_code VARCHAR(100) NULL,
  propertyname VARCHAR(255) NULL,
  posttype ENUM('Sell', 'Rent') NOT NULL DEFAULT 'Sell',
  expectedsaleprice DECIMAL(15,2) NOT NULL DEFAULT 0,
  monthly_rent DECIMAL(15,2) NOT NULL DEFAULT 0,
  buildup_area DECIMAL(15,2) NOT NULL DEFAULT 0,
  propertyuse VARCHAR(100) NULL,
  facing VARCHAR(50) NULL,
  age_of_property VARCHAR(100) NULL,
  sublocation VARCHAR(255) NULL,
  booking_status TINYINT NOT NULL DEFAULT 1,
  status TINYINT NOT NULL DEFAULT 1,
  meta_title VARCHAR(255) NULL,
  meta_description TEXT NULL,
  meta_keywords TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_industrial_code (industrial_space_code),
  INDEX idx_industrial_status (status),
  INDEX idx_industrial_posttype (posttype),
  INDEX idx_industrial_sublocation (sublocation),
  INDEX idx_industrial_propertyuse (propertyuse),
  INDEX idx_industrial_buildup_area (buildup_area),
  INDEX idx_industrial_age_of_property (age_of_property),
  INDEX idx_industrial_expectedsaleprice (expectedsaleprice),
  INDEX idx_industrial_monthly_rent (monthly_rent),
  INDEX idx_industrial_facing (facing),
  INDEX idx_industrial_booking_status (booking_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coworkers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  coworkers_code VARCHAR(100) NULL,
  propertyname VARCHAR(255) NULL,
  posttype ENUM('Sell', 'Rent') NOT NULL DEFAULT 'Sell',
  expected_rent_perseat DECIMAL(15,2) NOT NULL DEFAULT 0,
  monthly_rent DECIMAL(15,2) NOT NULL DEFAULT 0,
  buildup_area DECIMAL(15,2) NOT NULL DEFAULT 0,
  unittype VARCHAR(100) NULL,
  condition_space VARCHAR(100) NULL,
  floor VARCHAR(50) NULL,
  facing VARCHAR(50) NULL,
  property_age VARCHAR(100) NULL,
  sublocation VARCHAR(255) NULL,
  booking_status TINYINT NOT NULL DEFAULT 1,
  status TINYINT NOT NULL DEFAULT 1,
  meta_title VARCHAR(255) NULL,
  meta_description TEXT NULL,
  meta_keywords TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coworkers_code (coworkers_code),
  INDEX idx_coworkers_status (status),
  INDEX idx_coworkers_posttype (posttype),
  INDEX idx_coworkers_sublocation (sublocation),
  INDEX idx_coworkers_floor (floor),
  INDEX idx_coworkers_unittype (unittype),
  INDEX idx_coworkers_expected_rent_perseat (expected_rent_perseat),
  INDEX idx_coworkers_monthly_rent (monthly_rent),
  INDEX idx_coworkers_facing (facing),
  INDEX idx_coworkers_property_age (property_age),
  INDEX idx_coworkers_booking_status (booking_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO login (username, password, role, status)
VALUES ('admin', '$2b$12$InrGdBi/oAiRVXMrFepWZ.1wCZDW76SLNKZ8RlilV3ncUGFnCiOKu', 'admin', 1)
ON DUPLICATE KEY UPDATE username = VALUES(username);
