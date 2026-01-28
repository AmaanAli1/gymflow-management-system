-- ============================================
-- GYMFLOW DATABASE SEED FILE
-- Created from production data snapshot
-- Last updated: 2025-01-27
-- ============================================

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- CLEAR ALL TABLES
-- Remove existing data before inserting
-- ============================================

TRUNCATE TABLE check_ins;
TRUNCATE TABLE inventory;
TRUNCATE TABLE inventory_categories;
TRUNCATE TABLE inventory_stock;
TRUNCATE TABLE locations;
TRUNCATE TABLE members;
TRUNCATE TABLE payment_methods;
TRUNCATE TABLE payments;
TRUNCATE TABLE products;
TRUNCATE TABLE reorder_requests;
TRUNCATE TABLE revenue;
TRUNCATE TABLE shifts;
TRUNCATE TABLE staff;
TRUNCATE TABLE system_settings;
TRUNCATE TABLE vendors;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- SEED DATA
-- Exported from current database state
-- ============================================

-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: gymflow
-- ------------------------------------------------------
-- Server version	8.1.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `role` enum('admin','super_admin') DEFAULT 'admin',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` VALUES (1,'admin','$2b$10$X7xZBRvVumf2u3bP2SDctu7S95hVykiXrqNu63t8By8AvreO0zEJW','System Administrator','admin@gymflow.com','super_admin','2026-01-03 10:15:47','2026-01-06 22:10:00','2026-01-06 22:10:00');
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `check_ins`
--

DROP TABLE IF EXISTS `check_ins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `check_ins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `location_id` int NOT NULL,
  `check_in_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_checkins_member_id` (`member_id`),
  KEY `idx_checkins_time` (`check_in_time` DESC),
  KEY `idx_checkins_location_time` (`location_id`,`check_in_time` DESC),
  CONSTRAINT `fk_checkin_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_checkin_member` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `check_ins`
--

LOCK TABLES `check_ins` WRITE;
/*!40000 ALTER TABLE `check_ins` DISABLE KEYS */;
INSERT INTO `check_ins` VALUES (1,1,1,'2026-01-09 16:17:57','2026-01-09 21:17:57'),(2,1,1,'2026-01-09 20:55:54','2026-01-10 01:55:54'),(3,135,1,'2026-01-09 20:58:20','2026-01-10 01:58:20'),(4,7,1,'2026-01-09 21:00:22','2026-01-10 02:00:22'),(5,5,1,'2026-01-09 21:08:22','2026-01-10 02:08:22'),(6,4,2,'2026-01-09 21:09:06','2026-01-10 02:09:06'),(7,17,1,'2026-01-09 22:44:38','2026-01-10 03:44:38'),(8,135,2,'2026-01-11 19:50:02','2026-01-12 00:50:02'),(9,136,1,'2026-01-11 19:50:20','2026-01-12 00:50:20'),(10,6,3,'2026-01-11 19:50:47','2026-01-12 00:50:47'),(11,5,2,'2026-01-11 19:53:49','2026-01-12 00:53:49'),(12,4,1,'2026-01-11 19:54:23','2026-01-12 00:54:23'),(13,138,3,'2026-01-12 00:10:16','2026-01-12 05:10:16'),(14,137,1,'2026-01-12 00:13:24','2026-01-12 05:13:24');
/*!40000 ALTER TABLE `check_ins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory`
--

DROP TABLE IF EXISTS `inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_name` varchar(255) NOT NULL,
  `quantity` int NOT NULL,
  `threshold` int NOT NULL,
  `location_id` int NOT NULL,
  `status` enum('ok','low','critical') DEFAULT 'ok',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `location_id` (`location_id`),
  CONSTRAINT `inventory_ibfk_1` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory`
--

LOCK TABLES `inventory` WRITE;
/*!40000 ALTER TABLE `inventory` DISABLE KEYS */;
INSERT INTO `inventory` VALUES (1,'Protein Bars',45,50,1,'low','2026-01-01 08:57:00'),(2,'Dumbbells (20lb)',30,20,1,'ok','2026-01-01 08:57:00'),(3,'Towels',150,100,1,'ok','2026-01-01 08:57:00'),(4,'Energy Drinks',25,40,1,'critical','2026-01-01 08:57:00'),(5,'Protein Bars',60,50,2,'ok','2026-01-01 08:57:00'),(6,'Dumbbells (20lb)',25,20,2,'ok','2026-01-01 08:57:00'),(7,'Towels',120,100,2,'ok','2026-01-01 08:57:00'),(8,'Energy Drinks',35,40,2,'low','2026-01-01 08:57:00'),(9,'Protein Bars',55,50,3,'ok','2026-01-01 08:57:00'),(10,'Dumbbells (20lb)',18,20,3,'low','2026-01-01 08:57:00'),(11,'Towels',95,100,3,'low','2026-01-01 08:57:00'),(12,'Energy Drinks',50,40,3,'low','2026-01-01 08:57:00');
/*!40000 ALTER TABLE `inventory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_categories`
--

DROP TABLE IF EXISTS `inventory_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `icon` varchar(50) DEFAULT 'fa-box',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_categories`
--

LOCK TABLES `inventory_categories` WRITE;
/*!40000 ALTER TABLE `inventory_categories` DISABLE KEYS */;
INSERT INTO `inventory_categories` VALUES (1,'Supplements','Protein powders, pre-workouts, vitamins, and nutritional supplements','fa-pills','2026-01-21 07:17:29'),(2,'Beverages','Water, energy drinks, protein shakes, and refreshments','fa-bottle-water','2026-01-21 07:17:29'),(3,'Merchandise','Branded apparel, gym bags, accessories, and retail items','fa-shirt','2026-01-21 07:17:29'),(4,'Equipment','Resistance bands, yoga mats, foam rollers, and small fitness gear','fa-dumbbell','2026-01-21 07:17:29'),(5,'Supplies','Cleaning products, toiletries, first aid, and operational supplies','fa-spray-can-sparkles','2026-01-21 07:17:29');
/*!40000 ALTER TABLE `inventory_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_stock`
--

DROP TABLE IF EXISTS `inventory_stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_stock` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `location_id` int NOT NULL,
  `quantity` int DEFAULT '0',
  `last_restocked` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_product_location` (`product_id`,`location_id`),
  KEY `location_id` (`location_id`),
  CONSTRAINT `inventory_stock_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_stock_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=86 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_stock`
--

LOCK TABLES `inventory_stock` WRITE;
/*!40000 ALTER TABLE `inventory_stock` DISABLE KEYS */;
INSERT INTO `inventory_stock` VALUES (1,1,1,20,'2026-01-11 07:17:29','2026-01-21 07:17:29'),(2,2,1,15,'2026-01-06 07:17:29','2026-01-21 07:17:29'),(3,3,1,21,'2026-01-04 07:17:29','2026-01-21 07:17:29'),(4,4,1,23,'2026-01-03 07:17:29','2026-01-21 07:17:29'),(5,5,1,19,'2026-01-18 07:17:29','2026-01-21 07:17:29'),(6,6,1,10,'2025-12-31 07:17:29','2026-01-21 07:17:29'),(7,7,1,35,'2026-01-08 07:17:29','2026-01-21 07:17:29'),(8,8,1,45,'2026-01-16 07:17:29','2026-01-21 07:17:29'),(9,9,1,52,'2026-01-02 07:17:29','2026-01-21 07:17:29'),(10,10,1,48,'2025-12-27 07:17:29','2026-01-21 07:17:29'),(11,11,1,59,'2026-01-10 07:17:29','2026-01-21 07:17:29'),(12,12,1,54,'2026-01-11 07:17:29','2026-01-21 07:17:29'),(13,13,1,14,'2026-01-11 07:17:29','2026-01-21 07:17:29'),(14,14,1,33,'2026-01-12 07:17:29','2026-01-21 07:17:29'),(15,15,1,20,'2026-01-19 07:17:29','2026-01-21 07:17:29'),(16,16,1,49,'2025-12-30 07:17:29','2026-01-21 07:17:29'),(17,17,1,24,'2026-01-15 07:17:29','2026-01-21 07:17:29'),(18,18,1,23,'2026-01-02 07:17:29','2026-01-21 07:17:29'),(19,19,1,33,'2026-01-10 07:17:29','2026-01-21 07:17:29'),(20,20,1,35,'2026-01-08 07:17:29','2026-01-21 07:17:29'),(21,21,1,42,'2025-12-26 07:17:29','2026-01-21 07:17:29'),(22,22,1,35,'2025-12-25 07:17:29','2026-01-21 07:17:29'),(23,23,1,59,'2026-01-15 07:17:29','2026-01-21 07:17:29'),(32,1,2,11,'2026-01-18 07:17:29','2026-01-21 07:17:29'),(33,2,2,6,'2025-12-24 07:17:29','2026-01-21 07:17:29'),(34,3,2,26,'2025-12-25 07:17:29','2026-01-21 07:17:29'),(35,4,2,80,'2026-01-24 10:55:25','2026-01-24 10:55:25'),(36,5,2,43,'2026-01-01 07:17:29','2026-01-21 07:17:29'),(37,6,2,24,'2026-01-09 07:17:29','2026-01-21 07:17:29'),(38,7,2,30,'2025-12-25 07:17:29','2026-01-21 07:17:29'),(39,8,2,29,'2026-01-11 07:17:29','2026-01-21 07:17:29'),(40,9,2,38,'2026-01-15 07:17:29','2026-01-21 07:17:29'),(41,10,2,29,'2026-01-11 07:17:29','2026-01-21 07:17:29'),(42,11,2,44,'2025-12-27 07:17:29','2026-01-21 07:17:29'),(43,12,2,14,'2025-12-31 07:17:29','2026-01-21 07:17:29'),(44,13,2,36,'2025-12-26 07:17:29','2026-01-21 07:17:29'),(45,14,2,43,'2026-01-17 07:17:29','2026-01-21 07:17:29'),(46,15,2,42,'2026-01-15 07:17:29','2026-01-21 07:17:29'),(47,16,2,15,'2026-01-02 07:17:29','2026-01-21 07:17:29'),(48,17,2,22,'2026-01-15 07:17:29','2026-01-21 07:17:29'),(49,18,2,39,'2026-01-04 07:17:29','2026-01-21 07:17:29'),(50,19,2,16,'2025-12-31 07:17:29','2026-01-21 07:17:29'),(51,20,2,36,'2025-12-30 07:17:29','2026-01-21 07:17:29'),(52,21,2,18,'2026-01-06 07:17:29','2026-01-21 07:17:29'),(53,22,2,24,'2025-12-26 07:17:29','2026-01-21 07:17:29'),(54,23,2,42,'2026-01-20 07:17:29','2026-01-21 07:17:29'),(63,1,3,23,'2026-01-19 07:17:29','2026-01-21 07:17:29'),(64,2,3,11,'2026-01-16 07:17:29','2026-01-21 07:17:29'),(65,3,3,32,'2025-12-26 07:17:29','2026-01-21 07:17:29'),(66,4,3,18,'2025-12-27 07:17:29','2026-01-21 07:17:29'),(67,5,3,19,'2026-01-16 07:17:29','2026-01-21 07:17:29'),(68,6,3,38,'2025-12-27 07:17:29','2026-01-21 07:17:29'),(69,7,3,31,'2025-12-31 07:17:29','2026-01-21 07:17:29'),(70,8,3,28,'2025-12-28 07:17:29','2026-01-21 07:17:29'),(71,9,3,18,'2026-01-19 07:17:29','2026-01-21 07:17:29'),(72,10,3,27,'2026-01-06 07:17:29','2026-01-21 07:17:29'),(73,11,3,41,'2026-01-17 07:17:29','2026-01-21 07:17:29'),(74,12,3,40,'2026-01-15 07:17:29','2026-01-21 07:17:29'),(75,13,3,16,'2026-01-03 07:17:29','2026-01-21 07:17:29'),(76,14,3,17,'2026-01-04 07:17:29','2026-01-21 07:17:29'),(77,15,3,10,'2026-01-02 07:17:29','2026-01-21 07:17:29'),(78,16,3,10,'2026-01-10 07:17:29','2026-01-21 07:17:29'),(79,17,3,34,'2026-01-05 07:17:29','2026-01-21 07:17:29'),(80,18,3,24,'2026-01-01 07:17:29','2026-01-21 07:17:29'),(81,19,3,8,'2025-12-23 07:17:29','2026-01-21 07:17:29'),(82,20,3,40,'2025-12-31 07:17:29','2026-01-21 07:17:29'),(83,21,3,35,'2025-12-29 07:17:29','2026-01-21 07:17:29'),(84,22,3,27,'2026-01-07 07:17:29','2026-01-21 07:17:29'),(85,23,3,33,'2026-01-15 07:17:29','2026-01-21 07:17:29');
/*!40000 ALTER TABLE `inventory_stock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `locations`
--

DROP TABLE IF EXISTS `locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `capacity` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `locations`
--

LOCK TABLES `locations` WRITE;
/*!40000 ALTER TABLE `locations` DISABLE KEYS */;
INSERT INTO `locations` VALUES (1,'Downtown',350,'2025-12-31 19:34:05'),(2,'Midtown',550,'2025-12-31 19:34:05'),(3,'Eastside',500,'2025-12-31 19:34:05');
/*!40000 ALTER TABLE `locations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `members`
--

DROP TABLE IF EXISTS `members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` varchar(20) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `emergency_contact` varchar(255) DEFAULT NULL,
  `location_id` int NOT NULL,
  `plan` varchar(50) NOT NULL,
  `status` enum('active','frozen','cancelled','inactive') DEFAULT 'active',
  `notes` text,
  `freeze_start_date` date DEFAULT NULL,
  `freeze_end_date` date DEFAULT NULL,
  `freeze_reason` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `member_id` (`member_id`),
  KEY `location_id` (`location_id`),
  CONSTRAINT `members_ibfk_1` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=140 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `members`
--

LOCK TABLES `members` WRITE;
/*!40000 ALTER TABLE `members` DISABLE KEYS */;
INSERT INTO `members` VALUES (1,'M-0001','Tuba Ahad','tubaahad@hotmail.com','(555) 123-4567','(647) 982-0720',1,'Elite','active','Prefers morning classes. Interested in strength training.',NULL,NULL,NULL,'2025-12-31 19:34:05','2026-01-12 05:34:36'),(2,'M-0002','Vivek Bhatt','vivekbhatt@hotmail.com','(555) 234-5678','(555) 876-5432',1,'Premium','frozen','Recovering from knee injury. Avoid high-impact exercises.','2026-01-10','2026-02-10','Medical','2025-12-31 19:34:05','2026-01-12 05:35:45'),(3,'M-0003','Dil Dhaliwal','dildhaliwal@yahoo.com','(555) 345-6789',NULL,2,'Basic','frozen','New member. Wants to lose wight and build muscle.','2026-01-05','2026-01-12','Other','2025-12-31 19:34:05','2026-01-05 12:30:05'),(4,'M-0004','Manvir Dhaliwal','manvirdhaliwal@gmail.com',NULL,NULL,2,'Premium','active','Knee surgery recovery',NULL,NULL,NULL,'2025-12-31 19:34:05','2026-01-08 14:26:32'),(5,'M-0005','Kanav Kaura','kanavkaura@hotmail.com',NULL,NULL,3,'Basic','active',NULL,NULL,NULL,NULL,'2025-12-31 19:34:05','2026-01-06 00:34:49'),(6,'M-0006','Angad Chhabra','angadc@gmail.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2025-12-31 19:34:05','2026-01-02 15:35:48'),(7,'M-0007','Michael Johnson','michael.johnson@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(8,'M-0008','Sarah Williams','sarah.williams@email.com',NULL,NULL,1,'Elite','frozen',NULL,'2026-01-05','2026-01-19','Pregnancy','2026-01-01 10:16:01','2026-01-05 12:39:38'),(9,'M-0009','David Brown','david.brown@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(10,'M-0010','Emily Davis','emily.davis@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(11,'M-0011','James Miller','james.miller@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(12,'M-0012','Jennifer Wilson','jennifer.wilson@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(13,'M-0013','Robert Moore','robert.moore@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(14,'M-0014','Linda Taylor','linda.taylor@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(15,'M-0015','William Anderson','william.anderson@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-05 12:28:27'),(16,'M-0016','Mary Thomas','mary.thomas@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(17,'M-0017','Richard Jackson','richard.jackson@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(18,'M-0018','Patricia White','patricia.white@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(19,'M-0019','Christopher Harris','christopher.harris@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(20,'M-0020','Barbara Martin','barbara.martin@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(21,'M-0021','Daniel Thompson','daniel.thompson@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(22,'M-0022','Jessica Garcia','jessica.garcia@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(23,'M-0023','Matthew Martinez','matthew.martinez@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(24,'M-0024','Karen Robinson','karen.robinson@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(25,'M-0025','Anthony Clark','anthony.clark@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(26,'M-0026','Nancy Rodriguez','nancy.rodriguez@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(27,'M-0027','Mark Lewis','mark.lewis@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(28,'M-0028','Lisa Lee','lisa.lee@email.com',NULL,NULL,1,'Premium','frozen',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(29,'M-0029','Donald Walker','donald.walker@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(30,'M-0030','Betty Hall','betty.hall@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(31,'M-0031','Paul Allen','paul.allen@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(32,'M-0032','Helen Young','helen.young@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(33,'M-0033','Andrew Hernandez','andrew.hernandez@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(34,'M-0034','Sandra King','sandra.king@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(35,'M-0035','Kenneth Wright','kenneth.wright@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(36,'M-0036','Donna Lopez','donna.lopez@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(37,'M-0037','Joshua Hill','joshua.hill@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(38,'M-0038','Carol Scott','carol.scott@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(39,'M-0039','Kevin Green','kevin.green@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-08 14:27:28'),(40,'M-0040','Michelle Adams','michelle.adams@email.com',NULL,NULL,1,'Premium','cancelled',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(41,'M-0041','Brian Baker','brian.baker@email.com',NULL,NULL,1,'Elite','cancelled',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(42,'M-0042','Amanda Gonzalez','amanda.gonzalez@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(43,'M-0043','George Nelson','george.nelson@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(44,'M-0044','Melissa Carter','melissa.carter@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(45,'M-0045','Edward Mitchell','edward.mitchell@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(46,'M-0046','Deborah Perez','deborah.perez@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(47,'M-0047','Ronald Roberts','ronald.roberts@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(48,'M-0048','Stephanie Turner','stephanie.turner@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(49,'M-0049','Timothy Phillips','timothy.phillips@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(50,'M-0050','Rebecca Campbell','rebecca.campbell@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(51,'M-0051','Jason Parker','jason.parker@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(52,'M-0052','Laura Evans','laura.evans@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(53,'M-0053','Jeffrey Edwards','jeffrey.edwards@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(54,'M-0054','Kimberly Collins','kimberly.collins@email.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(55,'M-0055','Ryan Stewart','ryan.stewart@email.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(56,'M-0056','Sharon Sanchez','sharon.sanchez@email.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(57,'M-0057','Jacob Morris','jacob.morris@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(58,'M-0058','Cynthia Rogers','cynthia.rogers@email.com',NULL,NULL,2,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(59,'M-0059','Gary Reed','gary.reed@email.com',NULL,NULL,2,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(60,'M-0060','Kathleen Cook','kathleen.cook@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(61,'M-0061','Nicholas Morgan','nicholas.morgan@email.com',NULL,NULL,2,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(62,'M-0062','Amy Bell','amy.bell@email.com',NULL,NULL,2,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(63,'M-0063','Eric Murphy','eric.murphy@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(64,'M-0064','Angela Bailey','angela.bailey@email.com',NULL,NULL,2,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(65,'M-0065','Jonathan Rivera','jonathan.rivera@email.com',NULL,NULL,2,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(66,'M-0066','Shirley Cooper','shirley.cooper@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(67,'M-0067','Justin Richardson','justin.richardson@email.com',NULL,NULL,2,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(68,'M-0068','Anna Cox','anna.cox@email.com',NULL,NULL,2,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(69,'M-0069','Brandon Howard','brandon.howard@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(70,'M-0070','Brenda Ward','brenda.ward@email.com',NULL,NULL,2,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(71,'M-0071','Raymond Torres','raymond.torres@email.com',NULL,NULL,2,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(72,'M-0072','Pamela Peterson','pamela.peterson@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(73,'M-0073','Samuel Gray','samuel.gray@email.com',NULL,NULL,2,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(74,'M-0074','Nicole Ramirez','nicole.ramirez@email.com',NULL,NULL,2,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(75,'M-0075','Jack James','jack.james@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(76,'M-0076','Katherine Watson','katherine.watson@email.com',NULL,NULL,2,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(77,'M-0077','Alexander Brooks','alexander.brooks@email.com',NULL,NULL,2,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(78,'M-0078','Christine Kelly','christine.kelly@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(79,'M-0079','Patrick Sanders','patrick.sanders@email.com',NULL,NULL,2,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(80,'M-0080','Samantha Price','samantha.price@email.com',NULL,NULL,2,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(81,'M-0081','Jeremy Bennett','jeremy.bennett@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(82,'M-0082','Janet Wood','janet.wood@email.com',NULL,NULL,2,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(83,'M-0083','Dennis Barnes','dennis.barnes@email.com',NULL,NULL,2,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(84,'M-0084','Carolyn Ross','carolyn.ross@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(85,'M-0085','Jerry Henderson','jerry.henderson@email.com',NULL,NULL,2,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(86,'M-0086','Maria Coleman','maria.coleman@email.com',NULL,NULL,2,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(87,'M-0087','Tyler Jenkins','tyler.jenkins@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(88,'M-0088','Heather Perry','heather.perry@email.com',NULL,NULL,2,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(89,'M-0089','Aaron Powell','aaron.powell@email.com',NULL,NULL,2,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(90,'M-0090','Diane Long','diane.long@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(91,'M-0091','Jose Patterson','jose.patterson@email.com',NULL,NULL,2,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(92,'M-0092','Julie Hughes','julie.hughes@email.com',NULL,NULL,2,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(93,'M-0093','Adam Flores','adam.flores@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(94,'M-0094','Joyce Washington','joyce.washington@email.com',NULL,NULL,2,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(95,'M-0095','Nathan Butler','nathan.butler@email.com',NULL,NULL,2,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(96,'M-0096','Victoria Simmons','victoria.simmons@email.com',NULL,NULL,2,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(97,'M-0097','Zachary Foster','zachary.foster@email.com',NULL,NULL,3,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(98,'M-0098','Christina Gonzales','christina.gonzales@email.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(99,'M-0099','Kyle Bryant','kyle.bryant@email.com',NULL,NULL,3,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(100,'M-0100','Joan Alexander','joan.alexander@email.com',NULL,NULL,3,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(101,'M-0101','Noah Russell','noah.russell@email.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(102,'M-0102','Evelyn Griffin','evelyn.griffin@email.com',NULL,NULL,3,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(103,'M-0103','Henry Diaz','henry.diaz@email.com',NULL,NULL,3,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(104,'M-0104','Judy Hayes','judy.hayes@email.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(105,'M-0105','Douglas Myers','douglas.myers@email.com',NULL,NULL,3,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(106,'M-0106','Megan Ford','megan.ford@email.com',NULL,NULL,3,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(107,'M-0107','Peter Hamilton','peter.hamilton@email.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(108,'M-0108','Cheryl Graham','cheryl.graham@email.com',NULL,NULL,3,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(109,'M-0109','Carl Sullivan','carl.sullivan@email.com',NULL,NULL,3,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(110,'M-0110','Marie Wallace','marie.wallace@email.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(111,'M-0111','Keith Woods','keith.woods@email.com',NULL,NULL,3,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(112,'M-0112','Madison Cole','madison.cole@email.com',NULL,NULL,3,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(113,'M-0113','Roger West','roger.west@email.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(114,'M-0114','Amber Jordan','amber.jordan@email.com',NULL,NULL,3,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(115,'M-0115','Gerald Owens','gerald.owens@email.com',NULL,NULL,3,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(116,'M-0116','Danielle Reynolds','danielle.reynolds@email.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(117,'M-0117','Arthur Fisher','arthur.fisher@email.com',NULL,NULL,3,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(118,'M-0118','Brittany Ellis','brittany.ellis@email.com',NULL,NULL,3,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(119,'M-0119','Joe Gibson','joe.gibson@email.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(120,'M-0120','Olivia McDonald','olivia.mcdonald@email.com',NULL,NULL,3,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(121,'M-0121','Lawrence Cruz','lawrence.cruz@email.com',NULL,NULL,3,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(122,'M-0122','Jacqueline Marshall','jacqueline.marshall@email.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(123,'M-0123','Sean Ortiz','sean.ortiz@email.com',NULL,NULL,3,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(124,'M-0124','Kelly Gomez','kelly.gomez@email.com',NULL,NULL,3,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(125,'M-0125','Austin Murray','austin.murray@email.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(126,'M-0126','Teresa Freeman','teresa.freeman@email.com',NULL,NULL,3,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(127,'M-0127','Russell Wells','russell.wells@email.com',NULL,NULL,3,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(128,'M-0128','Gloria Webb','gloria.webb@email.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(129,'M-0129','Jesse Simpson','jesse.simpson@email.com',NULL,NULL,3,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(130,'M-0130','Doris Stevens','doris.stevens@email.com',NULL,NULL,3,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(131,'M-0131','Albert Tucker','albert.tucker@email.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-02 15:35:48'),(132,'M-0132','Sara Porter','sara.porter@email.com',NULL,NULL,3,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-06 22:12:43'),(133,'M-0133','Terry Hunter','terry.hunter@email.com',NULL,NULL,3,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-06 22:12:43'),(134,'M-0134','Kathryn Hicks','kathryn.hicks@email.com',NULL,NULL,3,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-01 10:16:01','2026-01-06 22:10:39'),(135,'M-0135','Valid Test User','validtest@example.com',NULL,NULL,1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-07 20:52:04','2026-01-07 20:52:04'),(136,'M-0136','Route Test Member','routetest@gymflow.com',NULL,NULL,1,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-11 04:19:07','2026-01-11 04:19:07'),(137,'M-0137','Abrar Ali','abrar_ali99@hotmail.com',NULL,NULL,1,'Elite','active',NULL,NULL,NULL,NULL,'2026-01-12 01:14:01','2026-01-12 01:14:01'),(138,'M-0138','Phone Test User','phonetestuser@gmail.com','(647) 980-0513','(647) 982-0720',3,'Basic','active',NULL,NULL,NULL,NULL,'2026-01-12 01:39:54','2026-01-12 01:39:54'),(139,'M-0139','Sana Ali','sana.ali@hotmail.com','(647) 238-3929','(647) 393-0230',1,'Premium','active',NULL,NULL,NULL,NULL,'2026-01-14 06:10:08','2026-01-14 06:10:08');
/*!40000 ALTER TABLE `members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_methods`
--

DROP TABLE IF EXISTS `payment_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_methods` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `card_type` enum('Visa','Mastercard','Amex','Discover','Other') NOT NULL,
  `last_four` char(4) NOT NULL,
  `expiry_month` tinyint NOT NULL,
  `expiry_year` year NOT NULL,
  `cardholder_name` varchar(10) DEFAULT NULL,
  `billing_zip` varchar(10) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `member_id` (`member_id`),
  CONSTRAINT `payment_methods_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_methods`
--

LOCK TABLES `payment_methods` WRITE;
/*!40000 ALTER TABLE `payment_methods` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_methods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_date` date NOT NULL,
  `payment_method` enum('Cash','Cheque','Credit Card','Bank Transfer','Other') NOT NULL,
  `status` enum('success','failed','pending','refunded') DEFAULT 'success',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `member_id` (`member_id`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (1,1,75.00,'2026-01-01','Credit Card','success',NULL,'2026-01-03 19:45:56','2026-01-03 19:45:56'),(2,1,75.00,'2025-12-01','Credit Card','success',NULL,'2026-01-03 19:45:56','2026-01-03 19:45:56'),(3,1,75.00,'2025-11-01','Credit Card','success',NULL,'2026-01-03 19:45:56','2026-01-03 19:45:56'),(4,1,75.00,'2025-10-01','Credit Card','success',NULL,'2026-01-03 19:45:56','2026-01-03 19:45:56'),(5,2,50.00,'2026-01-01','Cash','success',NULL,'2026-01-03 19:45:56','2026-01-03 19:45:56'),(6,2,50.00,'2025-12-01','Cash','success',NULL,'2026-01-03 19:45:56','2026-01-03 19:45:56'),(7,3,30.00,'2026-01-01','Credit Card','success',NULL,'2026-01-03 19:48:41','2026-01-03 19:48:41'),(8,3,30.00,'2025-12-01','Credit Card','failed','Card declined - insufficient funds','2026-01-03 19:48:41','2026-01-03 19:48:41'),(9,3,30.00,'2025-11-01','Credit Card','success',NULL,'2026-01-03 19:48:41','2026-01-03 19:48:41'),(10,5,30.00,'2026-01-01','Credit Card','refunded','Member requested refund - moving away','2026-01-03 19:48:44','2026-01-03 19:48:44'),(11,5,30.00,'2025-01-01','Credit Card','success',NULL,'2026-01-03 19:48:44','2026-01-03 19:48:44'),(12,2,50.00,'2026-02-01','Cash','success',NULL,'2026-01-06 22:08:58','2026-01-06 22:08:58'),(13,1,50.00,'2026-01-06','Credit Card','success',NULL,'2026-01-07 21:17:42','2026-01-07 21:17:42');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sku` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `category_id` int NOT NULL,
  `unit_price` decimal(10,2) DEFAULT '0.00',
  `cost_price` decimal(10,2) DEFAULT '0.00',
  `reorder_point` int DEFAULT '10',
  `reorder_quantity` int DEFAULT '25',
  `status` enum('active','discontinued') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `inventory_categories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'SUPP-001','Whey Protein 2lb','Premium whey protein powder - Chocolate',1,45.99,28.00,10,25,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(2,'SUPP-002','Whey Protein 2lb','Premium whey protein powder - Vanilla',1,45.99,28.00,10,25,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(3,'SUPP-003','Pre-Workout','Energy boost pre-workout formula',1,35.99,20.00,8,20,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(4,'SUPP-004','BCAAs','Branch chain amino acids - Berry flavor',1,29.99,15.00,10,25,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(5,'SUPP-005','Creatine Monohydrate','Pure creatine powder 500g',1,24.99,12.00,10,30,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(6,'BEV-001','Water Bottle 500ml','Purified drinking water',2,2.50,0.50,50,100,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(7,'BEV-002','Energy Drink','Sugar-free energy drink',2,3.99,1.75,30,60,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(8,'BEV-003','Protein Shake RTD','Ready-to-drink protein shake',2,5.99,3.00,20,40,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(9,'BEV-004','Coconut Water','Natural electrolyte drink',2,3.49,1.50,25,50,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(10,'MERCH-001','GymFlow T-Shirt','Branded cotton t-shirt - Various sizes',3,29.99,12.00,15,30,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(11,'MERCH-002','GymFlow Tank Top','Branded workout tank top',3,24.99,10.00,15,30,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(12,'MERCH-003','Gym Towel','Microfiber workout towel',3,14.99,5.00,20,40,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(13,'MERCH-004','Shaker Bottle','Protein shaker with mixer ball',3,12.99,4.00,20,50,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(14,'MERCH-005','Gym Bag','Duffel bag with shoe compartment',3,49.99,22.00,10,20,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(15,'EQUIP-001','Resistance Bands Set','5-band set with varying resistance',4,24.99,10.00,10,25,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(16,'EQUIP-002','Yoga Mat','Non-slip exercise mat 6mm',4,29.99,12.00,10,20,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(17,'EQUIP-003','Foam Roller','High-density foam roller 18\"',4,19.99,8.00,8,15,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(18,'EQUIP-004','Lifting Gloves','Padded weightlifting gloves',4,19.99,7.00,15,30,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(19,'EQUIP-005','Jump Rope','Speed jump rope adjustable',4,12.99,4.00,12,25,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(20,'SUPPLY-001','Disinfectant Wipes','Equipment cleaning wipes - 100ct',5,8.99,4.00,20,50,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(21,'SUPPLY-002','Hand Sanitizer','Pump bottle 500ml',5,6.99,2.50,15,40,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(22,'SUPPLY-003','Paper Towels','Multi-fold paper towels - Case',5,24.99,15.00,5,10,'active','2026-01-21 07:17:29','2026-01-21 07:17:29'),(23,'SUPPLY-004','First Aid Kit','Basic first aid supplies',5,29.99,18.00,3,6,'active','2026-01-21 07:17:29','2026-01-21 07:17:29');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reorder_requests`
--

DROP TABLE IF EXISTS `reorder_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reorder_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_number` varchar(20) NOT NULL,
  `product_id` int NOT NULL,
  `location_id` int NOT NULL,
  `quantity_requested` int NOT NULL,
  `quantity_received` int DEFAULT '0',
  `unit_cost` decimal(10,2) DEFAULT NULL,
  `total_cost` decimal(10,2) DEFAULT NULL,
  `status` enum('pending','approved','received','rejected') DEFAULT 'pending',
  `requested_by` varchar(100) DEFAULT NULL,
  `approved_by` varchar(100) DEFAULT NULL,
  `notes` text,
  `requested_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_at` timestamp NULL DEFAULT NULL,
  `vendor_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `request_number` (`request_number`),
  KEY `product_id` (`product_id`),
  KEY `location_id` (`location_id`),
  KEY `fk_vendor` (`vendor_id`),
  CONSTRAINT `fk_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reorder_requests_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `reorder_requests_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reorder_requests`
--

LOCK TABLES `reorder_requests` WRITE;
/*!40000 ALTER TABLE `reorder_requests` DISABLE KEYS */;
INSERT INTO `reorder_requests` VALUES (35,'RO-0001',1,1,50,NULL,28.00,1400.00,'pending','Staff - Sarah',NULL,'Running low on stock','2026-01-23 14:30:00',NULL,NULL),(36,'RO-0002',3,2,30,NULL,15.50,465.00,'pending','Staff - Mike',NULL,'Monthly restock','2026-01-22 19:15:00',NULL,NULL),(37,'RO-0003',5,1,100,NULL,2.50,250.00,'approved','Admin','Admin','Out of stock - urgent','2026-01-23 16:00:00','2026-01-24 10:45:41',NULL),(38,'RO-0004',7,3,20,NULL,45.00,900.00,'rejected','Staff - Lisa',NULL,'\nRejected by: Admin\nReason: No reason provided','2026-01-21 21:45:00',NULL,NULL),(39,'RO-0005',2,1,75,NULL,12.00,900.00,'approved','Staff - John','Admin','Approved for purchase','2026-01-20 15:00:00','2026-01-20 19:30:00',NULL),(40,'RO-0006',4,2,40,40,22.50,900.00,'received','Staff - Sarah','Admin',NULL,'2026-01-19 18:20:00','2026-01-20 14:15:00',NULL),(41,'RO-0007',6,3,60,NULL,8.75,525.00,'approved','Admin','Admin','Restocking after promotion','2026-01-21 13:00:00','2026-01-21 20:00:00',NULL),(42,'RO-0008',1,2,50,50,28.00,1400.00,'received','Staff - Mike','Admin',NULL,'2026-01-18 16:00:00','2026-01-18 20:00:00',NULL),(43,'RO-0009',3,1,80,80,15.50,1240.00,'received','Staff - Lisa','Admin','Regular monthly order','2026-01-17 14:30:00','2026-01-17 19:00:00',NULL),(44,'RO-0010',8,3,25,25,35.00,875.00,'received','Admin','Admin',NULL,'2026-01-16 15:15:00','2026-01-16 21:30:00',NULL),(45,'RO-0011',2,1,60,60,12.00,720.00,'received','Staff - Sarah','Admin','Holiday season prep','2026-01-15 17:00:00','2026-01-15 22:00:00',NULL),(46,'RO-0012',5,2,120,120,2.50,300.00,'received','Staff - John','Admin',NULL,'2026-01-19 13:45:00','2026-01-20 15:00:00',NULL),(47,'RO-0013',9,1,200,NULL,1.25,250.00,'rejected','Staff - Mike',NULL,'Budget constraints\nRejected by: Admin\nReason: Overstocked already','2026-01-20 20:00:00',NULL,NULL),(48,'RO-0014',4,3,15,NULL,22.50,337.50,'rejected','Staff - Lisa',NULL,'Duplicate request\nRejected by: Admin\nReason: Already ordered last week','2026-01-18 18:30:00',NULL,NULL),(49,'RO-0015',1,1,40,40,28.00,1120.00,'received','Admin','Admin',NULL,'2026-01-14 14:00:00','2026-01-14 19:00:00',NULL),(50,'RO-0016',6,2,55,55,8.75,481.25,'received','Staff - Sarah','Admin',NULL,'2026-01-13 16:30:00','2026-01-13 21:00:00',NULL),(51,'RO-0017',3,3,35,35,15.50,542.50,'received','Staff - Mike','Admin',NULL,'2026-01-12 15:00:00','2026-01-12 20:30:00',NULL),(52,'RO-0018',6,1,100,0,0.50,50.00,'approved','Admin','Admin',NULL,'2026-01-24 10:35:03','2026-01-24 10:41:16',NULL),(77,'RO-0030',1,1,50,0,2.50,125.00,'received','Admin',NULL,NULL,'2026-01-20 05:00:00',NULL,2),(78,'RO-0031',2,2,100,0,1.25,125.00,'approved','Admin',NULL,NULL,'2026-01-15 05:00:00',NULL,1),(79,'RO-0032',3,1,75,0,3.00,225.00,'pending','Admin',NULL,NULL,'2026-01-22 05:00:00',NULL,3),(80,'RO-0033',4,3,200,0,0.75,150.00,'received','Admin',NULL,NULL,'2025-12-10 05:00:00',NULL,4),(81,'RO-0034',5,2,30,0,15.00,450.00,'received','Admin',NULL,NULL,'2025-12-20 05:00:00',NULL,5),(82,'RO-0035',1,1,60,0,2.50,150.00,'received','Admin',NULL,NULL,'2025-12-05 05:00:00',NULL,2),(83,'RO-0036',2,3,150,0,1.25,187.50,'received','Admin',NULL,NULL,'2025-11-15 05:00:00',NULL,1),(84,'RO-0037',3,1,80,0,3.00,240.00,'received','Admin',NULL,NULL,'2025-11-25 05:00:00',NULL,3),(85,'RO-0038',4,2,120,0,0.75,90.00,'received','Admin',NULL,NULL,'2025-10-10 04:00:00',NULL,4),(86,'RO-0039',5,3,40,0,15.00,600.00,'received','Admin',NULL,NULL,'2025-10-20 04:00:00',NULL,5),(87,'RO-0040',1,1,70,0,2.50,175.00,'received','Admin',NULL,NULL,'2025-09-12 04:00:00',NULL,2),(88,'RO-0041',2,2,90,0,1.25,112.50,'received','Admin',NULL,NULL,'2025-09-18 04:00:00',NULL,1);
/*!40000 ALTER TABLE `reorder_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `revenue`
--

DROP TABLE IF EXISTS `revenue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `revenue` (
  `id` int NOT NULL AUTO_INCREMENT,
  `location_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `month` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `location_id` (`location_id`),
  CONSTRAINT `revenue_ibfk_1` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `revenue`
--

LOCK TABLES `revenue` WRITE;
/*!40000 ALTER TABLE `revenue` DISABLE KEYS */;
INSERT INTO `revenue` VALUES (1,1,28400.00,'2025-05-01','2026-01-01 08:57:00'),(2,1,29800.00,'2025-06-01','2026-01-01 08:57:00'),(3,1,30200.00,'2025-07-01','2026-01-01 08:57:00'),(4,1,31100.00,'2025-08-01','2026-01-01 08:57:00'),(5,1,31800.00,'2025-09-01','2026-01-01 08:57:00'),(6,1,32400.00,'2025-10-01','2026-01-01 08:57:00'),(7,2,22100.00,'2025-05-01','2026-01-01 08:57:00'),(8,2,22900.00,'2025-06-01','2026-01-01 08:57:00'),(9,2,23400.00,'2025-07-01','2026-01-01 08:57:00'),(10,2,24000.00,'2025-08-01','2026-01-01 08:57:00'),(11,2,24600.00,'2025-09-01','2026-01-01 08:57:00'),(12,2,25200.00,'2025-10-01','2026-01-01 08:57:00'),(13,3,17200.00,'2025-05-01','2026-01-01 08:57:00'),(14,3,17800.00,'2025-06-01','2026-01-01 08:57:00'),(15,3,18300.00,'2025-07-01','2026-01-01 08:57:00'),(16,3,18700.00,'2025-08-01','2026-01-01 08:57:00'),(17,3,19000.00,'2025-09-01','2026-01-01 08:57:00'),(18,3,19440.00,'2025-10-01','2026-01-01 08:57:00');
/*!40000 ALTER TABLE `revenue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shifts`
--

DROP TABLE IF EXISTS `shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_id` int NOT NULL,
  `location_id` int NOT NULL,
  `shift_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `role` varchar(50) NOT NULL,
  `status` enum('scheduled','completed','cancelled') DEFAULT 'scheduled',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_shift_date` (`shift_date`),
  KEY `idx_shift_id` (`staff_id`),
  KEY `idx_location_id` (`location_id`),
  CONSTRAINT `shifts_ibfk_1` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE CASCADE,
  CONSTRAINT `shifts_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shifts`
--

LOCK TABLES `shifts` WRITE;
/*!40000 ALTER TABLE `shifts` DISABLE KEYS */;
INSERT INTO `shifts` VALUES (1,1,1,'2026-01-20','09:00:00','17:00:00','Front Desk CSR','scheduled','Opening shift','2026-01-16 07:18:47','2026-01-16 07:18:47'),(2,2,1,'2026-01-20','13:00:00','21:00:00','Sales','scheduled','Evening coverage','2026-01-16 07:18:47','2026-01-16 07:18:47'),(3,3,2,'2026-01-21','06:00:00','14:00:00','Trainer','scheduled','Morning PT sessions','2026-01-16 07:18:47','2026-01-16 07:18:47'),(4,1,1,'2026-01-22','09:00:00','17:00:00','Front Desk CSR','scheduled',NULL,'2026-01-16 07:18:47','2026-01-16 07:18:47'),(5,4,1,'2026-01-23','10:00:00','18:00:00','Manager','scheduled','Mid-day shift','2026-01-16 07:18:47','2026-01-16 07:18:47'),(6,2,2,'2026-01-24','14:00:00','22:00:00','Sales','scheduled','Late shift','2026-01-16 07:18:47','2026-01-16 07:18:47'),(8,3,1,'2026-01-26','10:00:00','18:00:00','Trainer','scheduled','Weekend sessions','2026-01-16 07:18:47','2026-01-16 07:18:47'),(11,1,1,'2026-01-21','09:00:00','17:00:00','Front Desk CSR','scheduled',NULL,'2026-01-17 06:50:34','2026-01-17 06:50:34'),(12,1,1,'2026-01-21','12:00:00','18:00:00','Sales','scheduled',NULL,'2026-01-17 06:50:34','2026-01-17 06:50:34'),(13,2,1,'2026-01-22','09:00:00','17:00:00','Front Desk CSR','scheduled',NULL,'2026-01-17 06:50:44','2026-01-17 06:50:44');
/*!40000 ALTER TABLE `shifts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `staff`
--

DROP TABLE IF EXISTS `staff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_id` varchar(20) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `emergency_contact` varchar(255) DEFAULT NULL,
  `emergency_phone` varchar(20) DEFAULT NULL,
  `location_id` int NOT NULL,
  `role` varchar(50) NOT NULL,
  `specialty` enum('Strength','Hypertrophy','Weight Loss','Conditioning','Yoga / Mobility') DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `hourly_rate` decimal(10,2) DEFAULT NULL,
  `status` enum('active','on_leave','terminated','inactive') DEFAULT 'active',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `staff_id` (`staff_id`),
  KEY `location_id` (`location_id`),
  KEY `idx_staff_id` (`staff_id`),
  KEY `idx_staff_status` (`status`),
  CONSTRAINT `staff_ibfk_1` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff`
--

LOCK TABLES `staff` WRITE;
/*!40000 ALTER TABLE `staff` DISABLE KEYS */;
INSERT INTO `staff` VALUES (1,'S-0001','Sarah Johnson','sarah.j@gymflow.com','416-555-0101','Mike Johnson','416-555-0199',1,'Manager',NULL,'2022-01-15',28.50,'active','Excellent leadership skills. Certified in conflict resolution.','2026-01-13 05:55:33'),(2,'S-0002','Marcus Chen','marcus.c@gymflow.com','416-555-0102','Lisa Chen','416-555-0198',1,'Front Desk CSR',NULL,'2023-03-20',17.00,'active','Great with member relations. Speaks Mandarin and English.','2026-01-13 05:55:33'),(3,'S-0003','Emily Rodriguez','emily.r@gymflow.com','416-555-0103','Carlos Rodriguez','416-555-0197',2,'Sales',NULL,'2023-06-10',19.50,'active','Top sales performer for Q3 2024. Targets families and young professionals.','2026-01-13 05:55:33'),(4,'S-0004','David Kim','david.k@gymflow.com','416-555-0104','Jenny Kim','416-555-0196',1,'Operations',NULL,'2022-11-05',22.00,'active','HVAC certified. Handles all equipment maintenance and repairs.','2026-01-13 05:55:33'),(5,'S-0005','Alex Thompson','alex.t@gymflow.com','416-555-0105','Sam Thompson','416-555-0195',1,'Admin',NULL,'2022-08-01',32.00,'active','Manages payroll and benefits. Expert in Workday and ADP systems.','2026-01-13 05:55:33'),(6,'S-0006','Jessica Lee','jessica.l@gymflow.com','416-555-0106','Tom Lee','416-555-0194',2,'Front Desk CSR',NULL,'2024-01-10',17.50,'active','Part-time student. Available evenings and weekends only.','2026-01-13 05:55:33'),(7,'S-0007','James Wilson','james.w@gymflow.com','416-555-0107','Mary Wilson','416-555-0193',3,'Sales',NULL,'2023-09-15',20.00,'active','Former personal trainer. Strong product knowledge for supplements and equipment.','2026-01-13 05:55:33'),(8,'S-0008','Priya Patel','priya.p@gymflow.com','416-555-0108','Raj Patel','416-555-0192',2,'Operations',NULL,'2023-04-22',21.50,'on_leave','On maternity leave until March 2026. Return date confirmed.','2026-01-13 05:55:33'),(9,'S-0009','Chris Martinez','chris.m@gymflow.com','416-555-0109','Ana Martinez','416-555-0191',3,'Manager',NULL,'2022-12-01',27.00,'active','Bilingual (English/Spanish). Specializes in member retention strategies.','2026-01-13 05:55:33'),(10,'S-0010','Taylor Brown','taylor.b@gymflow.com','416-555-0110','Jordan Brown','416-555-0190',2,'Front Desk CSR',NULL,'2023-07-05',16.50,'terminated','Terminated October 2024 for excessive absences. Do not rehire.','2026-01-13 05:55:33'),(11,'S-0011','Test User','test.user@gymflow.com','(416) 555-9999','Jane Doe','(416) 555-8888',2,'Sales',NULL,'2026-01-13',25.00,'active',NULL,'2026-01-13 20:58:50'),(12,'S-0012','Test Valid Staff','test.valid.staff@gymflow.com','(416) 000-1111','John Doe','(416) 000-2222',2,'Operations',NULL,'2026-01-13',30.00,'active','Test staff for Phase 3','2026-01-13 21:02:29'),(13,'S-0013','Yusuf Ali','yusuf.ali@gymflow.com','(647) 409-0209','Amaan Ali','(647) 982-0720',1,'Admin',NULL,'2026-01-14',50.00,'active',NULL,'2026-01-14 06:07:25'),(14,'T-0001','Test Trainer','testtrainer@gymflow.com','(898) 328-2372','Abid Ali','(923) 892-3823',2,'Trainer','Conditioning','2026-01-19',NULL,'active',NULL,'2026-01-19 07:42:01'),(15,'T-0002','Test Trainer Two','testtrainertwo@gymflow.com','(903) 023-9023','Not Real','(039) 032-9239',3,'Trainer','Hypertrophy','2026-01-19',70.00,'active',NULL,'2026-01-19 07:59:00');
/*!40000 ALTER TABLE `staff` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `id` int NOT NULL DEFAULT '1',
  `currency_symbol` varchar(5) DEFAULT '$',
  `date_format` varchar(20) DEFAULT 'MM/DD/YYYY',
  `low_inventory_threshold` int DEFAULT '10',
  `capacity_warning_percent` int DEFAULT '85',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
INSERT INTO `system_settings` VALUES (1,'$','MM/DD/YYYY',15,90,'2026-01-27 06:54:19','2026-01-27 07:51:43');
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vendor_name` varchar(100) NOT NULL,
  `category` enum('Equipment','Supplies','Services','Other') DEFAULT 'Supplies',
  `contact_person` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address_street` varchar(200) DEFAULT NULL,
  `address_city` varchar(100) DEFAULT NULL,
  `address_province` varchar(50) DEFAULT NULL,
  `address_postal_code` varchar(10) DEFAULT NULL,
  `payment_terms` varchar(50) DEFAULT 'Net 30',
  `tax_id` varchar(50) DEFAULT NULL,
  `notes` text,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (1,'ABC Fitness Supply','Equipment','John Smith','john@abcfitness.com','416-555-0100','123 Industrial Ave','Toronto','ON','M5V 2T6','Net 30','BN123456789','Primary equipment supplier. Great pricing on bulk orders.','Active','2026-01-25 11:16:11','2026-01-25 11:16:11'),(2,'ProteinHub Distributors','Supplies','Sarah Lee','sarah@proteinhub.com','416-555-0101','456 Distribution Blvd','Mississauga','ON','L5B 3Y3','Net 30','BN987654321','Protein bars, shakes, and supplements. Weekly deliveries.','Active','2026-01-25 11:16:11','2026-01-25 11:16:11'),(3,'CleanPro Services','Services','Mike Johnson','mike@cleanpro.com','416-555-0102','789 Service Road','Brampton','ON','L6R 2K7','Net 15','BN555444333','Cleaning supplies and maintenance services.','Active','2026-01-25 11:16:11','2026-01-25 11:16:11'),(4,'Elite Gym Equipment','Equipment','David Chen','david@elitegym.com','905-555-0103','321 Commercial Dr','Markham','ON','L3R 9Z6','Net 60','BN222111000','High-end equipment. Longer payment terms available.','Active','2026-01-25 11:16:11','2026-01-25 11:16:11'),(5,'Healthy Snacks Co','Supplies','Emma Wilson','emma@healthysnacks.com','647-555-0104','654 Food Court','North York','ON','M2N 6K1','COD','BN777888999','Energy drinks, protein bars, healthy snacks. Cash on delivery only.','Active','2026-01-25 11:16:11','2026-01-25 11:16:11'),(6,'TechFit Solutions','Equipment','Robert Brown','robert@techfit.com','416-555-0105','987 Tech Park','Scarborough','ON','M1B 5K5','Net 30','BN666555444','Previously our main supplier. Contract ended. Keeping for reference.','Inactive','2026-01-25 11:16:11','2026-01-25 11:16:11');
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-27 13:57:24
