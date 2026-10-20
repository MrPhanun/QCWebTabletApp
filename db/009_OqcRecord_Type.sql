-- Type of a saved OQC record (Search Draft / Save column + search): 'Normal', 'First Slot' (the Part No's SPEC Type) or 'Sample' (Sample ticked).
-- Older records are Normal. Run once per database (dev: IT06-PC, prod: 192.168.1.22).

IF COL_LENGTH('dbo.OqcRecord', 'Type') IS NULL
  ALTER TABLE dbo.OqcRecord ADD [Type] varchar(20) NOT NULL CONSTRAINT DF_OqcRecord_Type DEFAULT 'Normal';
GO
IF OBJECT_ID('dbo.CK_OqcRecord_Type', 'C') IS NULL
  ALTER TABLE dbo.OqcRecord ADD CONSTRAINT CK_OqcRecord_Type CHECK ([Type] IN ('Normal', 'First Slot', 'Sample'));
GO
-- Records saved with the Sample tickbox / a First Slot Part No keep that in their pages (Data JSON)
UPDATE dbo.OqcRecord SET [Type] = 'Sample' WHERE [Type] = 'Normal' AND Data LIKE '%"sample":true%';
UPDATE dbo.OqcRecord SET [Type] = 'First Slot' WHERE [Type] = 'Normal' AND Data LIKE '%"type":"First Slot"%';
