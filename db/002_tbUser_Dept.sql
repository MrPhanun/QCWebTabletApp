-- Add a department to each user. Only users with Dept = 'QC' may edit QC master data (e.g. Sampling Plan).
-- Nullable, so existing rows and other applications that use tbUser keep working.
-- Run once per database (dev: IT06-PC, prod: 192.168.1.22), then set Dept for each user, e.g.:
--   UPDATE tbUser SET Dept = 'QC' WHERE ID IN ('...', '...');

IF COL_LENGTH('dbo.tbUser', 'Dept') IS NULL
  ALTER TABLE dbo.tbUser ADD Dept varchar(50) NULL;
