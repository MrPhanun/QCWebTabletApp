# Prints an .xlsx straight to a printer with Microsoft Excel (COM): powershell -File print-xlsx.ps1 <in.xlsx> <printer name> <out file> [-Check]
# Every sheet is printed with the template's own page setup. With "Microsoft Print to PDF" the PDF is written to <out file> without asking.
# -Check only selects the printer and opens the file (nothing is printed).
param([Parameter(Mandatory = $true)][string]$In, [Parameter(Mandatory = $true)][string]$Printer, [string]$OutFile = '', [switch]$Check)
$ErrorActionPreference = 'Stop'
# Excel names a printer "<name> on <port>"; the port is in the user's printer list
$dev = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Devices' -ErrorAction SilentlyContinue).$Printer
if (-not $dev) { throw "Printer '$Printer' is not installed on this PC" }
$port = ($dev -split ',')[1]
$xl = $null
try {
  $xl = New-Object -ComObject Excel.Application
  $xl.Visible = $false
  $xl.DisplayAlerts = $false
  $wb = $xl.Workbooks.Open($In, 0, $true)   # no link update, read only (Excel only accepts a printer once a workbook is open)
  $xl.ActivePrinter = "$Printer on $port"
  if (-not $Check) {
    $m = [Type]::Missing
    # From, To, Copies, Preview, ActivePrinter, PrintToFile, Collate, PrToFileName
    $wb.PrintOut($m, $m, $m, $m, $m, $true, $m, $OutFile)
  }
  $wb.Close($false)
} finally {
  if ($xl) { $xl.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl) }
}
