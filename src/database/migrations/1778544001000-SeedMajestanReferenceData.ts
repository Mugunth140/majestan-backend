import { MigrationInterface, QueryRunner } from 'typeorm';

const prerequisiteTableStatements = [
  `CREATE TABLE IF NOT EXISTS \`login\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`username\` varchar(100) NULL,
    \`password\` varchar(255) NOT NULL,
    \`status\` tinyint(4) NOT NULL DEFAULT 1,
    \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    \`role\` varchar(32) NOT NULL DEFAULT 'admin',
    \`updated_at\` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY \`uq_login_username\` (\`username\`),
    KEY \`idx_login_status\` (\`status\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`ageproperties\` (
    \`id\` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`date\` varchar(255) NULL,
    \`ageproperty\` varchar(255) NULL,
    \`status\` int(11) NOT NULL DEFAULT 1,
    \`created_at\` timestamp NULL DEFAULT NULL,
    \`updated_at\` timestamp NULL DEFAULT NULL,
    KEY \`idx_ageproperties_status\` (\`status\`),
    KEY \`idx_ageproperties_name\` (\`ageproperty\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`facing_directions\` (
    \`id\` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`date\` varchar(255) NULL,
    \`facing\` varchar(255) NULL,
    \`status\` int(11) NOT NULL DEFAULT 1,
    \`created_at\` timestamp NULL DEFAULT NULL,
    \`updated_at\` timestamp NULL DEFAULT NULL,
    KEY \`idx_facing_directions_status\` (\`status\`),
    KEY \`idx_facing_directions_name\` (\`facing\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`floors\` (
    \`id\` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`date\` varchar(255) NULL,
    \`floor\` varchar(255) NULL,
    \`status\` int(11) NOT NULL DEFAULT 1,
    \`created_at\` timestamp NULL DEFAULT NULL,
    \`updated_at\` timestamp NULL DEFAULT NULL,
    KEY \`idx_floors_status\` (\`status\`),
    KEY \`idx_floors_name\` (\`floor\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`furnishings\` (
    \`id\` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`date\` varchar(255) NULL,
    \`furnishing\` varchar(255) NULL,
    \`status\` int(11) NOT NULL DEFAULT 1,
    \`created_at\` timestamp NULL DEFAULT NULL,
    \`updated_at\` timestamp NULL DEFAULT NULL,
    KEY \`idx_furnishings_status\` (\`status\`),
    KEY \`idx_furnishings_name\` (\`furnishing\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`propertyuses\` (
    \`id\` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`date\` varchar(255) NULL,
    \`propertyuse\` varchar(255) NULL,
    \`status\` int(11) NOT NULL DEFAULT 1,
    \`created_at\` timestamp NULL DEFAULT NULL,
    \`updated_at\` timestamp NULL DEFAULT NULL,
    KEY \`idx_propertyuses_status\` (\`status\`),
    KEY \`idx_propertyuses_name\` (\`propertyuse\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`sublocations\` (
    \`id\` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`date\` varchar(255) NULL,
    \`sublocation\` varchar(255) NULL,
    \`status\` int(11) NOT NULL DEFAULT 1,
    \`created_at\` timestamp NULL DEFAULT NULL,
    \`updated_at\` timestamp NULL DEFAULT NULL,
    KEY \`idx_sublocations_status\` (\`status\`),
    KEY \`idx_sublocations_name\` (\`sublocation\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`unittypes\` (
    \`id\` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`date\` varchar(255) NULL,
    \`unittype\` varchar(255) NULL,
    \`status\` int(11) NOT NULL DEFAULT 1,
    \`created_at\` timestamp NULL DEFAULT NULL,
    \`updated_at\` timestamp NULL DEFAULT NULL,
    KEY \`idx_unittypes_status\` (\`status\`),
    KEY \`idx_unittypes_name\` (\`unittype\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const loginSeedStatement = "\nINSERT INTO `login` (`username`, `password`, `role`, `status`)\nVALUES\n  ('Majestan', '$2b$12$KZ1jHaL/6.eRBwBmEWzbw.icwZvUOLiBDAobDdssSMWoz4eckZo6u', 'admin', 1),\n  ('admin', '$2b$12$InrGdBi/oAiRVXMrFepWZ.1wCZDW76SLNKZ8RlilV3ncUGFnCiOKu', 'admin', 1)\nON DUPLICATE KEY UPDATE\n  `status` = VALUES(`status`),\n  `role` = VALUES(`role`)\n";

const seedStatements = [
  "INSERT INTO `ageproperties` (`id`, `date`, `ageproperty`, `status`, `created_at`, `updated_at`) VALUES\n(3, '2025-02-09 08:24:41', '0-1 YEARS', 1, '2025-02-09 02:54:41', '2025-02-09 02:54:41'),\n(4, '2025-02-09 08:24:53', '1-3YEARS', 1, '2025-02-09 02:54:53', '2025-02-09 02:54:53'),\n(5, '2025-02-09 08:25:06', '3-5YEARS', 1, '2025-02-09 02:55:06', '2025-02-09 02:55:06'),\n(6, '2025-02-09 08:25:22', '5-8YEARS', 1, '2025-02-09 02:55:22', '2025-02-09 02:55:22'),\n(7, '2025-02-09 08:25:35', '8-10YEARS', 1, '2025-02-09 02:55:35', '2025-02-09 02:55:35'),\n(8, '2025-02-09 08:25:47', '10-13YEARS', 1, '2025-02-09 02:55:47', '2025-02-09 02:55:47'),\n(9, '2025-02-09 08:26:00', '13-16YEARS', 1, '2025-02-09 02:56:00', '2025-02-09 02:56:00'),\n(10, '2025-02-09 08:26:18', '16-18 YEARS', 1, '2025-02-09 02:56:18', '2025-02-09 02:56:18'),\n(11, '2025-02-09 08:26:34', '18-20 YEARS', 1, '2025-02-09 02:56:34', '2025-02-09 02:56:34'),\n(12, '2025-02-09 08:26:52', '20-25 YEARS', 1, '2025-02-09 02:56:52', '2025-02-09 02:56:52'),\n(13, '2025-02-09 08:27:06', '25 YEARS AND ABOVE', 1, '2025-02-09 02:57:06', '2025-02-09 02:57:06')\nON DUPLICATE KEY UPDATE `ageproperty` = VALUES(`ageproperty`), `status` = VALUES(`status`)",
  "INSERT INTO `facing_directions` (`id`, `date`, `facing`, `status`, `created_at`, `updated_at`) VALUES\n(2, '2025-01-24 21:21:01', 'WEST', 1, '2025-01-10 07:38:36', '2025-01-24 15:51:01'),\n(3, '2025-01-24 21:20:30', 'NORTH', 1, '2025-01-21 05:10:44', '2025-01-24 15:50:30'),\n(5, '2025-01-24 21:20:39', 'SOUTH', 1, '2025-01-24 15:50:39', '2025-01-24 15:50:39'),\n(6, '2025-01-24 21:20:49', 'EAST', 1, '2025-01-24 15:50:49', '2025-01-24 15:50:49')\nON DUPLICATE KEY UPDATE `facing` = VALUES(`facing`), `status` = VALUES(`status`)",
  "INSERT INTO `floors` (`id`, `date`, `floor`, `status`, `created_at`, `updated_at`) VALUES\n(2, '2025-02-09 08:35:00', '1', 1, '2025-01-11 05:02:56', '2025-02-09 03:05:00'),\n(3, '2025-01-21 14:42:49', '2', 1, '2025-01-21 09:12:49', '2025-01-21 09:12:49'),\n(5, '2025-02-09 08:35:17', '3', 1, '2025-01-21 09:16:29', '2025-02-09 03:05:17'),\n(6, '2025-02-09 08:35:30', '4', 1, '2025-01-21 10:32:33', '2025-02-09 03:05:30'),\n(7, '2025-02-09 08:35:45', '5', 1, '2025-01-21 10:34:03', '2025-02-09 03:05:45'),\n(8, '2025-01-21 16:46:53', '6', 1, '2025-01-21 11:16:22', '2025-01-21 11:16:53'),\n(9, '2025-02-09 08:35:58', '7', 1, '2025-02-09 03:05:58', '2025-02-09 03:05:58'),\n(10, '2025-02-09 08:36:06', '8', 1, '2025-02-09 03:06:06', '2025-02-09 03:06:06'),\n(11, '2025-02-09 08:36:15', '9', 1, '2025-02-09 03:06:15', '2025-02-09 03:06:15'),\n(12, '2025-02-09 08:36:25', '10', 1, '2025-02-09 03:06:25', '2025-02-09 03:06:25'),\n(13, '2025-02-09 08:36:34', '11', 1, '2025-02-09 03:06:34', '2025-02-09 03:06:34'),\n(14, '2025-02-09 08:36:43', '12', 1, '2025-02-09 03:06:43', '2025-02-09 03:06:43'),\n(15, '2025-02-09 08:36:51', '13', 1, '2025-02-09 03:06:51', '2025-02-09 03:06:51'),\n(16, '2025-02-09 08:37:00', '14', 1, '2025-02-09 03:07:00', '2025-02-09 03:07:00'),\n(17, '2025-02-09 08:37:08', '15', 1, '2025-02-09 03:07:08', '2025-02-09 03:07:08'),\n(18, '2025-02-09 08:37:16', '16', 1, '2025-02-09 03:07:16', '2025-02-09 03:07:16'),\n(19, '2025-02-09 08:37:30', '17', 1, '2025-02-09 03:07:30', '2025-02-09 03:07:30'),\n(20, '2025-02-09 08:37:39', '18', 1, '2025-02-09 03:07:39', '2025-02-09 03:07:39'),\n(21, '2025-02-09 08:37:48', '19', 1, '2025-02-09 03:07:48', '2025-02-09 03:07:48'),\n(22, '2025-02-09 08:37:57', '20', 1, '2025-02-09 03:07:57', '2025-02-09 03:07:57'),\n(23, '2025-02-09 08:41:37', '21', 1, '2025-02-09 03:11:37', '2025-02-09 03:11:37'),\n(24, '2025-02-10 22:36:25', 'GROUND FLOOR', 1, '2025-02-10 17:06:25', '2025-02-10 17:06:25'),\n(26, '2025-02-10 22:36:58', 'BASEMENT', 1, '2025-02-10 17:06:58', '2025-02-10 17:06:58'),\n(27, '2025-02-10 22:37:13', 'SEMIBASEMENT', 1, '2025-02-10 17:07:13', '2025-02-10 17:07:13')\nON DUPLICATE KEY UPDATE `floor` = VALUES(`floor`), `status` = VALUES(`status`)",
  "INSERT INTO `furnishings` (`id`, `date`, `furnishing`, `status`, `created_at`, `updated_at`) VALUES\n(2, '2025-01-24 21:42:48', 'FULLY FURNISHED', 1, '2025-01-11 06:38:11', '2025-01-24 16:12:48'),\n(4, '2025-01-24 21:42:24', 'SEMI FURNISHED', 1, '2025-01-21 11:18:33', '2025-01-24 16:12:24'),\n(5, '2025-01-24 21:43:05', 'BARESHELL', 1, '2025-01-24 16:13:05', '2025-01-24 16:13:05')\nON DUPLICATE KEY UPDATE `furnishing` = VALUES(`furnishing`), `status` = VALUES(`status`)",
  "INSERT INTO `propertyuses` (`id`, `date`, `propertyuse`, `status`, `created_at`, `updated_at`) VALUES\n(2, '2025-01-24 21:40:18', 'SHOWROOMS', 1, '2025-01-10 12:58:59', '2025-01-24 16:10:18'),\n(5, '2025-01-24 21:40:06', 'SHOP', 1, '2025-01-21 11:14:26', '2025-01-24 16:10:06'),\n(7, '2025-01-24 21:40:31', 'OFFICE', 1, '2025-01-24 16:10:31', '2025-01-24 16:10:31'),\n(8, '2025-01-24 21:40:43', 'WAREHOUSE', 1, '2025-01-24 16:10:43', '2025-01-24 16:10:43'),\n(9, '2025-01-24 21:41:01', 'MANUFACTURING UNIT', 1, '2025-01-24 16:11:01', '2025-01-24 16:11:01'),\n(10, '2025-02-09 08:29:14', 'SALONS/GYM/HOTELS', 1, '2025-02-09 02:59:14', '2025-02-09 02:59:14')\nON DUPLICATE KEY UPDATE `propertyuse` = VALUES(`propertyuse`), `status` = VALUES(`status`)",
  "INSERT INTO `sublocations` (`id`, `date`, `sublocation`, `status`, `created_at`, `updated_at`) VALUES\n(2, '2025-02-18 11:31:38', 'Pappampatti', 1, '2025-02-17 09:23:56', '2025-02-18 06:01:38'),\n(3, '2025-02-18 11:27:48', 'Singanallur', 1, '2025-02-18 05:54:18', '2025-02-18 05:57:48'),\n(4, '2025-02-18 11:31:26', 'Peelamedu', 1, '2025-02-18 06:01:26', '2025-02-18 06:01:26'),\n(5, '2025-02-18 11:32:18', 'Saravanampatti', 1, '2025-02-18 06:02:18', '2025-02-18 06:02:18'),\n(6, '2025-02-18 11:32:43', 'Gandhipuram', 1, '2025-02-18 06:02:43', '2025-02-18 06:02:43'),\n(7, '2025-02-18 11:33:10', 'Thudiyalur', 1, '2025-02-18 06:03:10', '2025-02-18 06:03:10'),\n(8, '2025-02-19 20:22:33', 'GN Mills', 1, '2025-02-19 14:52:33', '2025-02-19 14:52:33'),\n(9, '2025-02-19 20:22:44', 'Nehru Nagar West', 1, '2025-02-19 14:52:44', '2025-02-19 14:52:44'),\n(12, '2025-02-19 20:23:27', 'Koundampalayam', 1, '2025-02-19 14:53:27', '2025-02-19 14:53:27'),\n(13, '2025-02-19 20:23:47', 'Kannampalayam', 1, '2025-02-19 14:53:47', '2025-02-19 14:53:47'),\n(14, '2025-02-19 20:24:00', 'Peedampalli', 1, '2025-02-19 14:54:00', '2025-02-19 14:54:00'),\n(15, '2025-02-19 20:24:14', 'Kuniyamuthur', 1, '2025-02-19 14:54:14', '2025-02-19 14:54:14'),\n(16, '2025-02-19 20:24:30', 'Mathampalayam', 1, '2025-02-19 14:54:30', '2025-02-19 14:54:30'),\n(17, '2025-02-19 20:24:43', 'Vellakinar Village', 1, '2025-02-19 14:54:43', '2025-02-19 14:54:43'),\n(18, '2025-02-19 20:24:53', 'Kurudampalayam', 1, '2025-02-19 14:54:53', '2025-02-19 14:54:53'),\n(19, '2025-02-19 20:25:08', 'Mylampatti', 1, '2025-02-19 14:55:08', '2025-02-19 14:55:08'),\n(20, '2025-02-19 20:25:23', 'Keeranatham', 1, '2025-02-19 14:55:23', '2025-02-19 14:55:23'),\n(21, '2025-02-19 20:25:50', 'Kurudampalayam', 1, '2025-02-19 14:55:50', '2025-02-19 14:55:50'),\n(22, '2025-02-19 20:26:14', 'Press Colony', 1, '2025-02-19 14:56:14', '2025-02-19 14:56:14'),\n(23, '2025-02-19 20:26:24', 'Ganeshapuram', 1, '2025-02-19 14:56:24', '2025-02-19 14:56:24'),\n(24, '2025-02-19 20:26:34', 'Kalapatti', 1, '2025-02-19 14:56:34', '2025-02-19 14:56:34'),\n(25, '2025-02-19 20:26:44', 'Bilichi', 1, '2025-02-19 14:56:44', '2025-02-19 14:56:44'),\n(26, '2025-02-19 20:26:57', 'Golden Nagar', 1, '2025-02-19 14:56:57', '2025-02-19 14:56:57'),\n(27, '2025-02-19 20:27:15', 'Kavundampalayam', 1, '2025-02-19 14:57:15', '2025-02-19 14:57:15'),\n(28, '2025-02-19 20:27:39', 'Koilmedu', 1, '2025-02-19 14:57:39', '2025-02-19 14:57:39'),\n(29, '2025-02-19 20:27:58', 'Gopalapuram', 1, '2025-02-19 14:57:58', '2025-02-19 14:57:58'),\n(30, '2025-02-19 20:28:12', 'Ettimadai', 1, '2025-02-19 14:58:12', '2025-02-19 14:58:12'),\n(31, '2025-02-19 20:28:24', 'Kovai Pudur', 1, '2025-02-19 14:58:24', '2025-02-19 14:58:24'),\n(32, '2025-02-19 20:28:39', 'Illango Nagar', 1, '2025-02-19 14:58:39', '2025-02-19 14:58:39'),\n(33, '2025-02-19 20:28:51', 'Ganapathy', 1, '2025-02-19 14:58:51', '2025-02-19 14:58:51'),\n(34, '2025-02-19 20:29:24', 'Malumichampatty', 1, '2025-02-19 14:59:24', '2025-02-19 14:59:24'),\n(35, '2025-02-19 20:29:34', 'Neelikonampalayam', 1, '2025-02-19 14:59:34', '2025-02-19 14:59:34'),\n(36, '2025-02-19 20:29:56', 'Ramanathapuram', 1, '2025-02-19 14:59:56', '2025-02-19 14:59:56'),\n(37, '2025-02-19 20:30:12', 'RS Puram', 1, '2025-02-19 15:00:12', '2025-02-19 15:00:12'),\n(38, '2025-02-19 20:30:37', 'New Siddhapudur', 1, '2025-02-19 15:00:37', '2025-02-19 15:00:37'),\n(39, '2025-02-19 20:30:59', 'Maniakarampalayam', 1, '2025-02-19 15:00:59', '2025-02-19 15:00:59'),\n(40, '2025-02-19 20:31:11', 'Masakalipalayam', 1, '2025-02-19 15:01:11', '2025-02-19 15:01:11'),\n(41, '2025-02-19 20:31:26', 'Ondipudur', 1, '2025-02-19 15:01:26', '2025-02-19 15:01:26'),\n(42, '2025-02-19 20:31:39', 'Saibaba Colony', 1, '2025-02-19 15:01:39', '2025-02-19 15:01:39'),\n(43, '2025-02-19 20:31:54', 'Saravanampatty', 1, '2025-02-19 15:01:54', '2025-02-19 15:01:54'),\n(44, '2025-02-19 20:32:09', 'Othakalmandapam', 1, '2025-02-19 15:02:09', '2025-02-19 15:02:09'),\n(45, '2025-02-19 20:32:22', 'Mettupalayam', 1, '2025-02-19 15:02:22', '2025-02-19 15:02:22'),\n(46, '2025-02-19 20:32:47', 'Selvapuram', 1, '2025-02-19 15:02:47', '2025-02-19 15:02:47'),\n(47, '2025-02-19 20:33:00', 'Sundarapuram', 1, '2025-02-19 15:03:00', '2025-02-19 15:03:00'),\n(48, '2025-02-19 20:33:13', 'TVS Nagar', 1, '2025-02-19 15:03:13', '2025-02-19 15:03:13'),\n(49, '2025-02-19 20:33:26', 'Singanallur', 1, '2025-02-19 15:03:26', '2025-02-19 15:03:26'),\n(50, '2025-02-19 20:33:38', 'Thondamuthur', 1, '2025-02-19 15:03:38', '2025-02-19 15:03:38'),\n(51, '2025-02-19 20:33:51', 'Vadavalli', 1, '2025-02-19 15:03:51', '2025-02-19 15:03:51'),\n(52, '2025-02-19 20:34:05', 'Vellalore', 1, '2025-02-19 15:04:05', '2025-02-19 15:04:05'),\n(53, '2025-02-19 20:59:49', 'Thudiyalur', 1, '2025-02-19 15:29:49', '2025-02-19 15:29:49'),\n(54, '2025-02-19 21:00:13', 'Sivanandhapuram', 1, '2025-02-19 15:30:13', '2025-02-19 15:30:13'),\n(55, '2025-02-19 21:00:47', 'Sundakkamuthur', 1, '2025-02-19 15:30:47', '2025-02-19 15:30:47'),\n(56, '2025-02-19 21:01:04', 'Trichy Road', 1, '2025-02-19 15:31:04', '2025-02-19 15:31:04'),\n(57, '2025-02-19 21:01:16', 'Anaikatti', 1, '2025-02-19 15:31:16', '2025-02-19 15:31:16'),\n(58, '2025-02-19 21:01:50', 'Annur', 1, '2025-02-19 15:31:50', '2025-02-19 15:31:50'),\n(59, '2025-02-19 21:02:01', 'Chettipalayam', 1, '2025-02-19 15:32:01', '2025-02-19 15:32:01'),\n(60, '2025-02-19 21:02:13', 'Fathima Nagar', 1, '2025-02-19 15:32:13', '2025-02-19 15:32:13'),\n(61, '2025-02-19 21:02:27', 'Athipalayam', 1, '2025-02-19 15:32:27', '2025-02-19 15:32:27'),\n(62, '2025-02-19 21:02:39', 'Chinthamanipudur', 1, '2025-02-19 15:32:39', '2025-02-19 15:32:39'),\n(63, '2025-02-19 21:02:50', 'Idikarai', 1, '2025-02-19 15:32:50', '2025-02-19 15:32:50'),\n(64, '2025-02-19 21:03:04', 'Avarampalayam', 1, '2025-02-19 15:33:04', '2025-02-19 15:33:04'),\n(65, '2025-02-19 21:03:17', 'Eachanari', 1, '2025-02-19 15:33:17', '2025-02-19 15:33:17'),\n(66, '2025-02-19 21:03:31', 'Irugur', 1, '2025-02-19 15:33:31', '2025-02-19 15:33:31'),\n(67, '2025-02-19 21:03:45', 'Belladhi', 1, '2025-02-19 15:33:45', '2025-02-19 15:33:45'),\n(68, '2025-02-19 21:03:58', 'Edayarpalayam', 1, '2025-02-19 15:33:58', '2025-02-19 15:33:58'),\n(69, '2025-02-19 21:04:19', 'Kallimadu', 1, '2025-02-19 15:34:19', '2025-02-19 15:34:19'),\n(70, '2025-02-19 21:06:03', 'Kallipalayam', 1, '2025-02-19 15:36:03', '2025-02-19 15:36:03'),\n(71, '2025-02-19 21:06:19', 'Kariampalayam', 1, '2025-02-19 15:36:19', '2025-02-19 15:36:19'),\n(72, '2025-02-19 21:06:31', 'Kumarapalayam', 1, '2025-02-19 15:36:31', '2025-02-19 15:36:31'),\n(73, '2025-02-19 21:06:42', 'Kanjampatti', 1, '2025-02-19 15:36:42', '2025-02-19 15:36:42'),\n(74, '2025-02-19 21:06:55', 'Kinathukadavu', 1, '2025-02-19 15:36:55', '2025-02-19 15:36:55'),\n(75, '2025-02-19 21:07:07', 'Kunnathur', 1, '2025-02-19 15:37:07', '2025-02-19 15:37:07'),\n(76, '2025-02-19 21:07:21', 'Kanuvai', 1, '2025-02-19 15:37:21', '2025-02-19 15:37:21'),\n(77, '2025-02-19 21:07:36', 'Kottaipalayam', 1, '2025-02-19 15:37:36', '2025-02-19 15:37:36'),\n(78, '2025-02-19 21:07:51', 'Kuppakonam Pudur', 1, '2025-02-19 15:37:51', '2025-02-19 15:37:51'),\n(79, '2025-02-19 21:08:04', 'Karamadai', 1, '2025-02-19 15:38:04', '2025-02-19 15:38:04'),\n(80, '2025-02-19 21:08:15', 'Kovilpalayam', 1, '2025-02-19 15:38:15', '2025-02-19 15:38:15'),\n(81, '2025-02-19 21:08:26', 'Kurumbapalayam', 1, '2025-02-19 15:38:26', '2025-02-19 15:38:26'),\n(82, '2025-02-19 21:22:58', 'Madampatti', 1, '2025-02-19 15:52:58', '2025-02-19 15:52:58'),\n(83, '2025-02-19 21:23:28', 'Mopperipalayam', 1, '2025-02-19 15:53:28', '2025-02-19 15:53:28'),\n(84, '2025-02-19 21:23:41', 'Narasimhanaickenpalayam', 1, '2025-02-19 15:53:41', '2025-02-19 15:53:41'),\n(85, '2025-02-19 21:24:03', 'Madukkarai', 1, '2025-02-19 15:54:03', '2025-02-19 15:54:03'),\n(86, '2025-02-19 21:24:22', 'Nadupalayam', 1, '2025-02-19 15:54:22', '2025-02-19 15:54:22'),\n(87, '2025-02-19 21:27:15', 'Navavoor', 1, '2025-02-19 15:57:15', '2025-02-19 15:57:15'),\n(88, '2025-02-19 21:27:24', 'Maruthamalai', 1, '2025-02-19 15:57:24', '2025-02-19 15:57:24'),\n(89, '2025-02-19 21:27:46', 'Nallampalayam', 1, '2025-02-19 15:57:46', '2025-02-19 15:57:46'),\n(90, '2025-02-19 21:27:56', 'Neelambur', 1, '2025-02-19 15:57:56', '2025-02-19 15:57:56'),\n(91, '2025-02-19 21:28:12', 'Masagoundenchettipalayam', 1, '2025-02-19 15:58:12', '2025-02-19 15:58:12'),\n(92, '2025-02-19 21:28:22', 'Nanjundapuram', 1, '2025-02-19 15:58:22', '2025-02-19 15:58:22'),\n(93, '2025-02-19 21:28:34', 'Pachapalayam', 1, '2025-02-19 15:58:34', '2025-02-19 15:58:34'),\n(94, '2025-02-19 21:28:48', 'Paduvampalli', 1, '2025-02-19 15:58:48', '2025-02-19 15:58:48'),\n(95, '2025-02-19 21:29:02', 'Peelamedu', 1, '2025-02-19 15:59:02', '2025-02-19 15:59:02'),\n(96, '2025-02-19 21:29:12', 'Podanur', 1, '2025-02-19 15:59:12', '2025-02-19 15:59:12'),\n(97, '2025-02-19 21:29:25', 'Pannimadai', 1, '2025-02-19 15:59:25', '2025-02-19 15:59:25'),\n(98, '2025-02-19 21:29:39', 'Periyanaickenpalayam', 1, '2025-02-19 15:59:39', '2025-02-19 15:59:39'),\n(99, '2025-02-19 21:29:53', 'Pollachi', 1, '2025-02-19 15:59:53', '2025-02-19 15:59:53'),\n(100, '2025-02-19 21:35:19', 'Pappampatti', 1, '2025-02-19 16:05:19', '2025-02-19 16:05:19'),\n(101, '2025-02-19 21:35:29', 'Perur', 1, '2025-02-19 16:05:29', '2025-02-19 16:05:29'),\n(102, '2025-02-19 21:35:46', 'Poosaripalayam', 1, '2025-02-19 16:05:46', '2025-02-19 16:05:46'),\n(103, '2025-02-19 21:35:58', 'Pattanam', 1, '2025-02-19 16:05:58', '2025-02-19 16:05:58'),\n(104, '2025-02-19 21:36:10', 'PN Pudur', 1, '2025-02-19 16:06:10', '2025-02-19 16:06:10'),\n(105, '2025-02-19 21:36:28', 'Puliakulam', 1, '2025-02-19 16:06:28', '2025-02-19 16:06:28'),\n(106, '2025-02-19 21:36:46', 'Race Course', 1, '2025-02-19 16:06:46', '2025-02-19 16:06:46'),\n(107, '2025-02-19 21:36:57', 'Somayampalayam', 1, '2025-02-19 16:06:57', '2025-02-19 16:06:57'),\n(110, '2025-02-19 21:37:19', 'Thennampalayam', 1, '2025-02-19 16:07:19', '2025-02-19 16:07:19'),\n(111, '2025-02-19 21:37:27', 'Ram Nagar', 1, '2025-02-19 16:07:27', '2025-02-19 16:07:27'),\n(112, '2025-02-19 21:38:08', 'Sulur', 1, '2025-02-19 16:08:08', '2025-02-19 16:08:08'),\n(113, '2025-02-19 21:38:18', 'Town Hall', 1, '2025-02-19 16:08:18', '2025-02-19 16:08:18'),\n(114, '2025-02-19 21:38:28', 'Sanganoor', 1, '2025-02-19 16:08:28', '2025-02-19 16:08:28'),\n(115, '2025-02-19 21:38:41', 'Tatabad', 1, '2025-02-19 16:08:41', '2025-02-19 16:08:41'),\n(116, '2025-02-19 21:39:03', 'Uppilipalayam', 1, '2025-02-19 16:09:03', '2025-02-19 16:09:03'),\n(117, '2025-02-19 21:39:20', 'Somanur', 1, '2025-02-19 16:09:20', '2025-02-19 16:09:20'),\n(118, '2025-02-19 21:39:32', 'Telungupalayam', 1, '2025-02-19 16:09:32', '2025-02-19 16:09:32'),\n(119, '2025-02-19 21:39:49', 'Vadamadurai', 1, '2025-02-19 16:09:49', '2025-02-19 16:09:49'),\n(120, '2025-02-19 21:40:03', 'Vadaputhur', 1, '2025-02-19 16:10:03', '2025-02-19 16:10:03'),\n(121, '2025-02-19 21:40:17', 'Vellanaipatti', 1, '2025-02-19 16:10:17', '2025-02-19 16:10:17'),\n(122, '2025-02-19 21:40:27', 'Vedapatti', 1, '2025-02-19 16:10:27', '2025-02-19 16:10:27'),\n(123, '2025-02-19 21:40:41', 'Villankurichi', 1, '2025-02-19 16:10:41', '2025-02-19 16:10:41'),\n(124, '2025-02-19 21:40:52', 'Veerakeralam', 1, '2025-02-19 16:10:52', '2025-02-19 16:10:52'),\n(125, '2025-02-19 21:41:08', 'Veerapandi Pirivu', 1, '2025-02-19 16:11:08', '2025-02-19 16:11:08'),\n(126, '2025-03-02 22:30:47', 'chinniampalayam', 1, '2025-03-02 17:00:47', '2025-03-02 17:00:47'),\n(127, '2025-03-02 22:30:57', 'Hope college', 1, '2025-03-02 17:00:57', '2025-03-02 17:00:57')\nON DUPLICATE KEY UPDATE `sublocation` = VALUES(`sublocation`), `status` = VALUES(`status`)",
  "INSERT INTO `unittypes` (`id`, `date`, `unittype`, `status`, `created_at`, `updated_at`) VALUES\n(2, '2025-02-11 16:20:32', '1BHK', 1, NULL, '2025-02-11 10:50:32'),\n(3, '2025-02-11 16:20:41', '2BHK', 1, '2025-01-21 09:20:59', '2025-02-11 10:50:41'),\n(5, '2025-02-11 16:20:54', '2.5BHK', 1, '2025-02-11 10:50:54', '2025-02-11 10:50:54'),\n(6, '2025-02-11 16:21:03', '3BHK', 1, '2025-02-11 10:51:03', '2025-02-11 10:51:03'),\n(7, '2025-02-11 16:21:11', '4BHK', 1, '2025-02-11 10:51:11', '2025-02-11 10:51:11'),\n(8, '2025-02-11 16:21:22', '5BHK', 1, '2025-02-11 10:51:22', '2025-02-11 10:51:22')\nON DUPLICATE KEY UPDATE `unittype` = VALUES(`unittype`), `status` = VALUES(`status`)"
];

const downStatements = [
  "DELETE FROM `login` WHERE `username` IN ('Majestan', 'admin')",
  "DELETE FROM `unittypes` WHERE `id` IN (2,3,5,6,7,8)",
  "DELETE FROM `propertyuses` WHERE `id` IN (2,5,7,8,9,10)",
  "DELETE FROM `furnishings` WHERE `id` IN (2,4,5)",
  "DELETE FROM `facing_directions` WHERE `id` IN (2,3,5,6)",
  "DELETE FROM `ageproperties` WHERE `id` BETWEEN 3 AND 13",
  "DELETE FROM `floors` WHERE `id` IN (2,3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,26,27)",
  "DELETE FROM `sublocations` WHERE `id` BETWEEN 2 AND 127"
];

export class SeedMajestanReferenceData1778544001000
  implements MigrationInterface
{
  name = 'SeedMajestanReferenceData1778544001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of prerequisiteTableStatements) {
      await queryRunner.query(statement);
    }

    await queryRunner.query(loginSeedStatement);

    for (const statement of seedStatements) {
      await queryRunner.query(statement);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const statement of downStatements) {
      const match = statement.match(/`([^`]+)`/);
      const tableName = match?.[1];
      if (tableName && !(await queryRunner.hasTable(tableName))) {
        continue;
      }
      await queryRunner.query(statement);
    }
  }
}
