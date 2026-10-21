-- A Part No may have more than one SPEC row, but two rows of the same Part No cannot have the same
-- Wire + Terminal + Housing + Other (checked in server/routes/spec.js; the columns are too wide for a unique index).
-- Run once per database (dev: IT06-PC, prod: 192.168.1.22).

IF OBJECT_ID('dbo.UQ_MstSpec_PartNo', 'UQ') IS NOT NULL
  ALTER TABLE dbo.MstSpec DROP CONSTRAINT UQ_MstSpec_PartNo;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MstSpec_PartNo' AND object_id = OBJECT_ID('dbo.MstSpec'))
  CREATE INDEX IX_MstSpec_PartNo ON dbo.MstSpec (PartNo);
