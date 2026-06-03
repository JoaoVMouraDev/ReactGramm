-- Migration: add googleId and githubId columns if they don't exist yet
-- Run this if upgrading from a version before OAuth social login support

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `googleId` varchar(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS `githubId` varchar(255) UNIQUE;
