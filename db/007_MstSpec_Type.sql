-- Type of a SPEC (Part No): 'First Slot' or 'Normal' (default). Run once per database (dev: IT06-PC, prod: 192.168.1.22).
-- The Part Nos that are First Slot are set afterwards: node tools/set_spec_type.js --env=<env> <file with one Part No per line>

IF COL_LENGTH('dbo.MstSpec', 'Type') IS NULL
  ALTER TABLE dbo.MstSpec ADD [Type] varchar(20) NOT NULL CONSTRAINT DF_MstSpec_Type DEFAULT 'Normal';
GO
IF OBJECT_ID('dbo.CK_MstSpec_Type', 'C') IS NULL
  ALTER TABLE dbo.MstSpec ADD CONSTRAINT CK_MstSpec_Type CHECK ([Type] IN ('Normal', 'First Slot'));
