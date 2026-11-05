-- POS = the Lot No read from the scanned label ("24-0702961/9417/10/004" -> POS 24-0702961).
-- LotNo stays the date Lot typed on the form. Run once per database (dev: IT06-PC, prod: 192.168.1.22).

IF COL_LENGTH('dbo.OqcRecord', 'Pos') IS NULL
  ALTER TABLE dbo.OqcRecord ADD Pos varchar(50) NOT NULL CONSTRAINT DF_OqcRecord_Pos DEFAULT '';
