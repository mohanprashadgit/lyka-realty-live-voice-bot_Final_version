-- Lyka Realty AI CRM — TiDB 5 Core Tables Schema
-- Verified active tables on TiDB Cloud (gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000)
-- Date: 2026-10-31

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------
-- Table: customers
-- -----------------------------------------------------
CREATE TABLE `customers` (
  `id` varchar(36) NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `customer_name_raw` varchar(255) DEFAULT NULL,
  `customer_preferred_name` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `phone_normalized` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `current_location` varchar(500) DEFAULT NULL,
  `budget_range` varchar(100) DEFAULT NULL,
  `preferred_property_type` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `preferred_contact` varchar(50) DEFAULT 'phone',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_phone` (`phone_normalized`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- -----------------------------------------------------
-- Table: leads
-- -----------------------------------------------------
CREATE TABLE `leads` (
  `id` varchar(36) NOT NULL,
  `customer_id` varchar(36) DEFAULT NULL,
  `guest_session_id` varchar(36) DEFAULT NULL,
  `lead_source` varchar(100) DEFAULT NULL,
  `intent` varchar(100) DEFAULT NULL,
  `property_type` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `state_province` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `locality` varchar(255) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `original_location` text DEFAULT NULL,
  `property_size` varchar(100) DEFAULT NULL,
  `area_unit` varchar(50) DEFAULT NULL,
  `budget_min` decimal(18,2) DEFAULT NULL,
  `budget_max` decimal(18,2) DEFAULT NULL,
  `currency` varchar(10) DEFAULT NULL,
  `rental_period` varchar(50) DEFAULT NULL,
  `bedrooms` varchar(20) DEFAULT NULL,
  `bathrooms` varchar(20) DEFAULT NULL,
  `amenities` text DEFAULT NULL,
  `timeline` varchar(100) DEFAULT NULL,
  `temperature` varchar(20) DEFAULT 'WARM',
  `pipeline_status` varchar(50) DEFAULT 'new',
  `assigned_agent` varchar(36) DEFAULT NULL,
  `additional_prefs` text DEFAULT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `customer_name_raw` varchar(255) DEFAULT NULL,
  `customer_preferred_name` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `preferred_contact_method` varchar(50) DEFAULT 'phone',
  `best_time_to_contact` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_customer` (`customer_id`),
  KEY `idx_session` (`guest_session_id`),
  KEY `idx_temp` (`temperature`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- -----------------------------------------------------
-- Table: conversations
-- -----------------------------------------------------
CREATE TABLE `conversations` (
  `id` varchar(36) NOT NULL,
  `lead_id` varchar(36) DEFAULT NULL,
  `customer_id` varchar(36) DEFAULT NULL,
  `session_id` varchar(36) NOT NULL,
  `channel` varchar(20) NOT NULL DEFAULT 'text',
  `language` varchar(20) DEFAULT 'english',
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ended_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_lead` (`lead_id`),
  KEY `idx_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- -----------------------------------------------------
-- Table: conversation_messages
-- -----------------------------------------------------
CREATE TABLE `conversation_messages` (
  `id` varchar(36) NOT NULL,
  `conversation_id` varchar(36) NOT NULL,
  `role` varchar(20) NOT NULL,
  `content` text DEFAULT NULL,
  `message_type` varchar(20) DEFAULT 'text',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_convo` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- -----------------------------------------------------
-- Table: lead_interactions
-- -----------------------------------------------------
CREATE TABLE `lead_interactions` (
  `id` varchar(36) NOT NULL,
  `lead_id` varchar(36) NOT NULL,
  `interaction_type` varchar(50) NOT NULL,
  `summary` text DEFAULT NULL,
  `metadata` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_lead` (`lead_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

SET FOREIGN_KEY_CHECKS = 1;
