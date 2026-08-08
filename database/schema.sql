-- สร้างฐานข้อมูล accident_db
CREATE DATABASE IF NOT EXISTS accident_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE accident_db;

-- 1.ตาราง provinces
CREATE TABLE IF NOT EXISTS provinces (
    province_code VARCHAR(10) NOT NULL PRIMARY KEY,
    pro_name_th VARCHAR(100),
    pro_name_en VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.ตาราง districts
CREATE TABLE IF NOT EXISTS districts (
    district_code VARCHAR(10) NOT NULL PRIMARY KEY,
    province_code VARCHAR(10) NOT NULL,
    dis_name_th VARCHAR(100),
    dis_name_en VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (province_code) REFERENCES provinces(province_code)
);

-- 3.ตาราง accidents
CREATE TABLE IF NOT EXISTS accidents (
    accident_id INT AUTO_INCREMENT PRIMARY KEY,
    province_code VARCHAR (10) NOT NULL,
    district_code VARCHAR (10),
    agency VARCHAR (100),
    road_name VARCHAR (150),
    vehicle VARCHAR (150),
    location_type VARCHAR (100),
    presumed_cause VARCHAR (150),
    incident_type VARCHAR (150),
    weather VARCHAR (150),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    deaths INT DEFAULT 0,
    serious_injuries INT DEFAULT 0,
    minor_injuries INT DEFAULT 0,
    total_injuries INT DEFAULT 0,
    hour INT,
    year INT,
    month INT,
    day INT,
    is_weekend BOOLEAN DEFAULT FALSE,
    time_period VARCHAR(100),
    severity_level VARCHAR(100),
    is_new_year BOOLEAN DEFAULT FALSE,
    is_songkran BOOLEAN DEFAULT FALSE,
    is_dangerouse_7days BOOLEAN DEFAULT FALSE,
    day_type ENUM('Normal', 'Holiday', 'Festival') DEFAULT 'Normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (province_code) REFERENCES provinces(province_code),
    FOREIGN KEY (district_code) REFERENCES districts(district_code),
    INDEX idx_accidents_province (province_code),
    INDEX idx_accidents_date (year)
);

-- 4.ตาราง risk_scores (คะแนนความเสี่ยง + SHAP)
CREATE TABLE IF NOT EXISTS risk_scores (
    risk_id INT AUTO_INCREMENT PRIMARY KEY,
    province_code VARCHAR(10) NOT NULL,
    district_code VARCHAR(10),
    time_period VARCHAR(100) NOT NULL,
    day_type ENUM('Normal', 'Holiday', 'Festival') NOT NULL,
    risk_score DECIMAL(5,2) NOT NULL,
    risk_level ENUM('Low', 'Medium', 'High') NOT NULL,
    sample_size INT DEFAULT 0,
    top_factors VARCHAR(255),
    year INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (province_code) REFERENCES provinces(province_code),
    FOREIGN KEY (district_code) REFERENCES districts(district_code)
);

-- 5.ตาราง hotspots (พิกัดจุดความหนาแน่น KDE)
CREATE TABLE IF NOT EXISTS hotspots (
    hotspot_id INT AUTO_INCREMENT PRIMARY KEY,
    province_code VARCHAR(10) NOT NULL,
    district_code VARCHAR(10),
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    density_score FLOAT NOT NULL,
    year INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, 
    FOREIGN KEY (province_code) REFERENCES provinces(province_code),
    FOREIGN KEY (district_code) REFERENCES districts(district_code)
);

-- 6.ตาราง summaries 
CREATE TABLE IF NOT EXISTS summaries (
    summary_id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL,
    province_code VARCHAR(10) NOT NULL,
    district_code VARCHAR(10),
    time_period VARCHAR(100) NOT NULL,
    day_type ENUM('Normal', 'Holiday', 'Festival') NOT NULL,
    total_accidents INT DEFAULT 0,
    total_deaths INT DEFAULT 0,
    total_injuries INT DEFAULT 0,
    risk_score DECIMAL(5,2) NOT NULL,
    risk_level ENUM('Low', 'Medium', 'High') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, 
    FOREIGN KEY (province_code) REFERENCES provinces(province_code),
    FOREIGN KEY (district_code) REFERENCES districts(district_code)
);