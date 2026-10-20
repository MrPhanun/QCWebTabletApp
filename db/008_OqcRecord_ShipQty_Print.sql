-- Search Draft / Save: whether its Excel / PDF were downloaded (Printed) or not (Draft).
-- The server stores the downloaded file (exports\oqc\<SysNo>.xlsx / .pdf) so it can be downloaded again later.
-- Any change to the record puts both back to Draft (0) and removes the stored files, so a new download is made.
-- Run once per database (dev: IT06-PC, prod: 192.168.1.22).

IF COL_LENGTH('dbo.OqcRecord', 'ExcelPrinted') IS NULL
  ALTER TABLE dbo.OqcRecord ADD ExcelPrinted bit NOT NULL CONSTRAINT DF_OqcRecord_ExcelPrinted DEFAULT 0;
IF COL_LENGTH('dbo.OqcRecord', 'ExcelDate') IS NULL
  ALTER TABLE dbo.OqcRecord ADD ExcelDate datetime NULL;
IF COL_LENGTH('dbo.OqcRecord', 'PdfPrinted') IS NULL
  ALTER TABLE dbo.OqcRecord ADD PdfPrinted bit NOT NULL CONSTRAINT DF_OqcRecord_PdfPrinted DEFAULT 0;
IF COL_LENGTH('dbo.OqcRecord', 'PdfDate') IS NULL
  ALTER TABLE dbo.OqcRecord ADD PdfDate datetime NULL;
