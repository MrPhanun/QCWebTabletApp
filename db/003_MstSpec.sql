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
