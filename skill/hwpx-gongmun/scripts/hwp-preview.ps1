# Open an hwpx in Hancom Office (Windows) and save it as PDF plus one PNG per page.
# Use it to confirm a generated document really opens in Hangul and looks right.
#   powershell -ExecutionPolicy Bypass -File hwp-preview.ps1 -Hwpx result.hwpx -OutDir preview [-Scale 1.2]
param(
  [Parameter(Mandatory = $true)][string]$Hwpx,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [double]$Scale = 1.2
)
$ErrorActionPreference = 'Stop'
$Hwpx = (Resolve-Path $Hwpx).Path
New-Item -ItemType Directory -Force $OutDir | Out-Null
$OutDir = (Resolve-Path $OutDir).Path
$pdf = Join-Path $OutDir (([IO.Path]::GetFileNameWithoutExtension($Hwpx)) + '.pdf')

$hwp = New-Object -ComObject HWPFrame.HwpObject
try {
  $null = $hwp.RegisterModule('FilePathCheckDLL', 'FilePathCheckerModule')
  if (-not $hwp.Open($Hwpx, 'HWPX', 'forceopen:true')) { throw 'Hangul could not open the file.' }
  "pages: $($hwp.PageCount)"
  if (-not $hwp.SaveAs($pdf, 'PDF', '')) { throw 'Saving PDF failed.' }
} finally {
  try { $hwp.Clear(1) } catch {}
  $hwp.Quit()
}
"PDF: $pdf"

# The PDF renderer must run in a fresh process (see pdf-to-png.ps1).
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'pdf-to-png.ps1') -Pdf $pdf -OutDir $OutDir -Scale $Scale
if ($LASTEXITCODE -ne 0) { throw 'PNG rendering failed. The PDF was saved.' }
