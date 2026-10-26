-- Soft delete: Delete no longer removes the row, it sets DelStatus = 'Deleted' (searchable as Deleted, hidden from Active).
-- Applies to MstSamplingPlan, MstSpec and OqcRecord. Run once per database (dev: IT06-PC, prod: 192.168.1.22).

IF COL_LENGTH('dbo.MstSamplingPlan', 'DelStatus') IS NULL
  ALTER TABLE dbo.MstSamplingPlan ADD DelStatus varchar(10) NOT NULL CONSTRAINT DF_MstSamplingPlan_DelStatus DEFAULT 'Active';
GO
IF COL_LENGTH('dbo.MstSpec', 'DelStatus') IS NULL
  ALTER TABLE dbo.MstSpec ADD DelStatus varchar(10) NOT NULL CONSTRAINT DF_MstSpec_DelStatus DEFAULT 'Active';
GO
IF COL_LENGTH('dbo.OqcRecord', 'DelStatus') IS NULL
  ALTER TABLE dbo.OqcRecord ADD DelStatus varchar(10) NOT NULL CONSTRAINT DF_OqcRecord_DelStatus DEFAULT 'Active';
GO

-- A deleted record must not block saving the same Lot + Box again: uniqueness only counts Active rows
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_OqcRecord_LotBox' AND parent_object_id = OBJECT_ID('dbo.OqcRecord'))
  ALTER TABLE dbo.OqcRecord DROP CONSTRAINT UQ_OqcRecord_LotBox;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OqcRecord_LotBox_Active' AND object_id = OBJECT_ID('dbo.OqcRecord'))
  CREATE UNIQUE INDEX UX_OqcRecord_LotBox_Active ON dbo.OqcRecord (LotNo, BoxNo) WHERE DelStatus = 'Active';
