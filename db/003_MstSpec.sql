-- SPEC master (តំលៃប្រវែងកំនត់ / SPEC): per Part No, the material check text and the length check
-- positions + SPEC printed on the OQC Inspection record (e.g. Part No FM4-H915-000: position 1 -> 20±5).
-- MstSpec = one row per Part No; MstSpecLength = up to 22 length rows (№ 1-22) per item.
-- Run once per database (dev: IT06-PC, prod: 192.168.1.22).

IF OBJECT_ID('dbo.MstSpec', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MstSpec (
    SysNo      int IDENTITY(1,1) NOT NULL CONSTRAINT PK_MstSpec PRIMARY KEY,
    Customer   nvarchar(100) NOT NULL CONSTRAINT DF_MstSpec_Customer DEFAULT '',
    PartNo     nvarchar(100) NOT NULL CONSTRAINT UQ_MstSpec_PartNo UNIQUE,
    Wire       nvarchar(1000) NOT NULL CONSTRAINT DF_MstSpec_Wire DEFAULT '',
    Terminal   nvarchar(1000) NOT NULL CONSTRAINT DF_MstSpec_Terminal DEFAULT '',
    Housing    nvarchar(1000) NOT NULL CONSTRAINT DF_MstSpec_Housing DEFAULT '',
    Other      nvarchar(1000) NOT NULL CONSTRAINT DF_MstSpec_Other DEFAULT '',
    RegBy      varchar(80)   NOT NULL,
    RegDate    datetime      NOT NULL CONSTRAINT DF_MstSpec_RegDate DEFAULT GETDATE(),
    UpdateBy   varchar(80)   NOT NULL,
    UpdateDate datetime      NOT NULL CONSTRAINT DF_MstSpec_UpdateDate DEFAULT GETDATE()
  );
END

-- Customer was added after the first version of this table
IF COL_LENGTH('dbo.MstSpec', 'Customer') IS NULL
  ALTER TABLE dbo.MstSpec ADD Customer nvarchar(100) NOT NULL CONSTRAINT DF_MstSpec_Customer DEFAULT '';

-- Material lists from the BOM can be over 500 characters (first version allowed 200)
IF COL_LENGTH('dbo.MstSpec', 'Wire') < 2000
BEGIN
  ALTER TABLE dbo.MstSpec ALTER COLUMN Wire     nvarchar(1000) NOT NULL;
  ALTER TABLE dbo.MstSpec ALTER COLUMN Terminal nvarchar(1000) NOT NULL;
  ALTER TABLE dbo.MstSpec ALTER COLUMN Housing  nvarchar(1000) NOT NULL;
  ALTER TABLE dbo.MstSpec ALTER COLUMN Other    nvarchar(1000) NOT NULL;
END

-- ItemCode (Marunix item) was the key of the first version; SPEC is now looked up by Part No only.
-- Before running this on a table with data, make sure every row has a Part No and no Part No is repeated.
IF COL_LENGTH('dbo.MstSpec', 'ItemCode') IS NOT NULL
BEGIN
  IF OBJECT_ID('dbo.UQ_MstSpec_ItemCode', 'UQ') IS NOT NULL ALTER TABLE dbo.MstSpec DROP CONSTRAINT UQ_MstSpec_ItemCode;
  ALTER TABLE dbo.MstSpec DROP COLUMN ItemCode;
END
IF OBJECT_ID('dbo.UQ_MstSpec_PartNo', 'UQ') IS NULL
BEGIN
  IF OBJECT_ID('dbo.DF_MstSpec_PartNo', 'D') IS NOT NULL ALTER TABLE dbo.MstSpec DROP CONSTRAINT DF_MstSpec_PartNo;
  ALTER TABLE dbo.MstSpec ADD CONSTRAINT UQ_MstSpec_PartNo UNIQUE (PartNo);
END

IF OBJECT_ID('dbo.MstSpecLength', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MstSpecLength (
    SpecNo   int           NOT NULL CONSTRAINT FK_MstSpecLength_MstSpec REFERENCES dbo.MstSpec (SysNo) ON DELETE CASCADE,
    [LineNo] tinyint       NOT NULL CONSTRAINT CK_MstSpecLength_LineNo CHECK ([LineNo] BETWEEN 1 AND 22),
    Position nvarchar(50)  NOT NULL CONSTRAINT DF_MstSpecLength_Position DEFAULT '',
    Spec     nvarchar(50)  NOT NULL CONSTRAINT DF_MstSpecLength_Spec DEFAULT '',
    CONSTRAINT PK_MstSpecLength PRIMARY KEY (SpecNo, [LineNo])
  );
END

-- A Part No can have more than 22 length lines: 22 per page (№ 1-22 page 1, 23-44 page 2, ...), up to 200 lines (10 pages)
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_MstSpecLength_LineNo' AND definition LIKE '%<=(22))')
  ALTER TABLE dbo.MstSpecLength DROP CONSTRAINT CK_MstSpecLength_LineNo;
IF OBJECT_ID('dbo.CK_MstSpecLength_LineNo', 'C') IS NULL
  ALTER TABLE dbo.MstSpecLength ADD CONSTRAINT CK_MstSpecLength_LineNo CHECK ([LineNo] BETWEEN 1 AND 200);

-- Position / Spec up to 100 characters (imported SPEC lists)
IF COL_LENGTH('dbo.MstSpecLength', 'Position') < 200 ALTER TABLE dbo.MstSpecLength ALTER COLUMN Position nvarchar(100) NOT NULL;
IF COL_LENGTH('dbo.MstSpecLength', 'Spec') < 200 ALTER TABLE dbo.MstSpecLength ALTER COLUMN Spec nvarchar(100) NOT NULL;

-- SPEC split into the value and its tolerances: "100 (+10/-5)" -> Spec 100, SpecMinus -5, SpecPlus +10; "30±5" -> 30, -5, +5.
-- Other forms (0.5~2mm, ≤20, Max15, (L=30), ...) stay as text in Spec with empty tolerances.
IF COL_LENGTH('dbo.MstSpecLength', 'SpecMinus') IS NULL
  ALTER TABLE dbo.MstSpecLength ADD SpecMinus nvarchar(20) NOT NULL CONSTRAINT DF_MstSpecLength_SpecMinus DEFAULT '';
IF COL_LENGTH('dbo.MstSpecLength', 'SpecPlus') IS NULL
  ALTER TABLE dbo.MstSpecLength ADD SpecPlus nvarchar(20) NOT NULL CONSTRAINT DF_MstSpecLength_SpecPlus DEFAULT '';
GO
-- "100 (+10/-5)"
UPDATE dbo.MstSpecLength
SET SpecPlus  = LTRIM(RTRIM(SUBSTRING(Spec, CHARINDEX('(', Spec) + 1, CHARINDEX('/', Spec) - CHARINDEX('(', Spec) - 1))),
    SpecMinus = LTRIM(RTRIM(SUBSTRING(Spec, CHARINDEX('/', Spec) + 1, CHARINDEX(')', Spec) - CHARINDEX('/', Spec) - 1))),
    Spec      = LTRIM(RTRIM(LEFT(Spec, CHARINDEX('(', Spec) - 1)))
WHERE SpecMinus = '' AND SpecPlus = ''
  AND Spec LIKE '[0-9]%(+[0-9]%/-[0-9]%)' AND Spec NOT LIKE '%[^0-9. (+/)-]%';
-- "30±5"
UPDATE dbo.MstSpecLength
SET SpecMinus = '-' + SUBSTRING(Spec, CHARINDEX(N'±', Spec) + 1, 20),
    SpecPlus  = '+' + SUBSTRING(Spec, CHARINDEX(N'±', Spec) + 1, 20),
    Spec      = LEFT(Spec, CHARINDEX(N'±', Spec) - 1)
WHERE SpecMinus = '' AND SpecPlus = ''
  AND Spec LIKE N'[0-9]%±[0-9]%' AND Spec NOT LIKE N'%[^0-9.±]%';

-- Range of each line, "min-max" (e.g. 10 -2 +2 -> "8-12", 2±1mm -> "1-3", 0.5~2mm -> "0.5-2", ≤20 -> "0-20"): the OK / NG
-- check of the samples compares against it. Empty when the SPEC has no range to check ((30), (L=30), 5Ref, ...).
-- The server works it out on every save; fill the existing rows once with: node tools/fill_spec_range.js --env=<env>
IF COL_LENGTH('dbo.MstSpecLength', 'Range') IS NULL
  ALTER TABLE dbo.MstSpecLength ADD [Range] nvarchar(30) NOT NULL CONSTRAINT DF_MstSpecLength_Range DEFAULT '';
