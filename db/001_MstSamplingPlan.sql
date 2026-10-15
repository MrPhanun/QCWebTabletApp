-- Sampling plan master: for each inspection level, a Shipment Qty range maps to a sample Qty.
-- Example: Level = Hard, Shipment Qty 101-150 -> Qty 100
-- Run once per database (dev: IT06-PC, prod: 192.168.1.22).

IF OBJECT_ID('dbo.MstSamplingPlan', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MstSamplingPlan (
    SysNo      int IDENTITY(1,1) NOT NULL CONSTRAINT PK_MstSamplingPlan PRIMARY KEY,
    [Level]    varchar(10)  NOT NULL CONSTRAINT CK_MstSamplingPlan_Level CHECK ([Level] IN ('Normal', 'Hard')),
    QtyFrom    int          NOT NULL,
    QtyTo      int          NOT NULL,
    SampleQty  int          NOT NULL,
    RegBy      varchar(80)  NOT NULL,
    RegDate    datetime     NOT NULL CONSTRAINT DF_MstSamplingPlan_RegDate DEFAULT GETDATE(),
    UpdateBy   varchar(80)  NOT NULL,
    UpdateDate datetime     NOT NULL CONSTRAINT DF_MstSamplingPlan_UpdateDate DEFAULT GETDATE(),
    CONSTRAINT CK_MstSamplingPlan_Range CHECK (QtyFrom >= 1 AND QtyTo >= QtyFrom AND SampleQty >= 1)
  );
  CREATE INDEX IX_MstSamplingPlan_Level ON dbo.MstSamplingPlan ([Level], QtyFrom);
END
