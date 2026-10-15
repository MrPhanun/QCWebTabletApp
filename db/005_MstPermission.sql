-- Roles & Permissions: per-user rights for each page (view) and button (add / edit / delete / excel).
-- One row per allowed permission. A user with a "_custom" row uses exactly the rows listed;
-- a user with no rows at all uses the default rules in server.js (everyone views, QC edits, Admin manages users/permissions).
-- Run once per database (dev: IT06-PC, prod: 192.168.1.22).

IF OBJECT_ID('dbo.MstPermission', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MstPermission (
    UserID     varchar(10) NOT NULL,
    PermKey    varchar(50) NOT NULL,
    UpdateBy   varchar(80) NOT NULL,
    UpdateDate datetime    NOT NULL CONSTRAINT DF_MstPermission_UpdateDate DEFAULT GETDATE(),
    CONSTRAINT PK_MstPermission PRIMARY KEY (UserID, PermKey)
  );
END
