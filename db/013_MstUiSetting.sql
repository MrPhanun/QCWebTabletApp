-- Administration > Customize UI: look of the OQC Data Information screen (font sizes, column widths, colours).
-- One row per screen; SettingValue is a JSON object of the values changed from the default.
-- Run once per database (dev: IT06-PC, prod: 192.168.1.22).

IF OBJECT_ID('dbo.MstUiSetting', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MstUiSetting (
    SettingKey   varchar(50)   NOT NULL CONSTRAINT PK_MstUiSetting PRIMARY KEY,
    SettingValue nvarchar(max) NOT NULL,
    UpdateBy     varchar(80)   NOT NULL,
    UpdateDate   datetime      NOT NULL CONSTRAINT DF_MstUiSetting_UpdateDate DEFAULT GETDATE()
  );
END
