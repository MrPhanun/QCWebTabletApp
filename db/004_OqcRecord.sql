-- Saved OQC Inspection records (OQC Data Information page): one record per shipping label (LotNo + BoxNo).
-- The searchable fields are columns; every page of the sheet is stored in Data as JSON, with fields named
-- by meaning (e.g. items."PRESSING CONDITION", lengths[].samples), so adding or removing form items keeps old records readable.
-- Run once per database (dev: IT06-PC, prod: 192.168.1.22).

IF OBJECT_ID('dbo.OqcRecord', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.OqcRecord (
    SysNo       int IDENTITY(1,1) NOT NULL CONSTRAINT PK_OqcRecord PRIMARY KEY,
    LotNo       varchar(50)   NOT NULL,
    BoxNo       varchar(20)   NOT NULL CONSTRAINT DF_OqcRecord_BoxNo DEFAULT '',
    ItemCode    varchar(50)   NOT NULL CONSTRAINT DF_OqcRecord_ItemCode DEFAULT '',
    PartNo      nvarchar(100) NOT NULL CONSTRAINT DF_OqcRecord_PartNo DEFAULT '',
    Customer    nvarchar(200) NOT NULL CONSTRAINT DF_OqcRecord_Customer DEFAULT '',
    CheckDate   date          NULL,
    Qty         int           NULL,
    Probability varchar(10)   NOT NULL CONSTRAINT DF_OqcRecord_Probability DEFAULT '',
    Total       varchar(2)    NOT NULL CONSTRAINT DF_OqcRecord_Total DEFAULT '',
    Inspector   nvarchar(80)  NOT NULL CONSTRAINT DF_OqcRecord_Inspector DEFAULT '',
    CheckedBy   nvarchar(80)  NOT NULL CONSTRAINT DF_OqcRecord_CheckedBy DEFAULT '',
    PageCount   tinyint       NOT NULL,
    Complete    bit           NOT NULL CONSTRAINT DF_OqcRecord_Complete DEFAULT 0,
    Data        nvarchar(max) NOT NULL,
    RegBy       varchar(80)   NOT NULL,
    RegDate     datetime      NOT NULL CONSTRAINT DF_OqcRecord_RegDate DEFAULT GETDATE(),
    UpdateBy    varchar(80)   NOT NULL,
    UpdateDate  datetime      NOT NULL CONSTRAINT DF_OqcRecord_UpdateDate DEFAULT GETDATE(),
    CONSTRAINT UQ_OqcRecord_LotBox UNIQUE (LotNo, BoxNo),
    CONSTRAINT CK_OqcRecord_Total CHECK (Total IN ('', 'OK', 'NG'))
  );
  CREATE INDEX IX_OqcRecord_UpdateDate ON dbo.OqcRecord (UpdateDate DESC);
END
