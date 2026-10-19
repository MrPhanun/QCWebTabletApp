-- Shipment Date of a saved OQC record (OQC Data Information: required to save; Search Draft / Save filters on it).
-- Older records have no Shipment Date (NULL). Run once per database (dev: IT06-PC, prod: 192.168.1.22).

IF COL_LENGTH('dbo.OqcRecord', 'ShipmentDate') IS NULL
BEGIN
  ALTER TABLE dbo.OqcRecord ADD ShipmentDate date NULL;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OqcRecord_ShipmentDate' AND object_id = OBJECT_ID('dbo.OqcRecord'))
  CREATE INDEX IX_OqcRecord_ShipmentDate ON dbo.OqcRecord (ShipmentDate);
