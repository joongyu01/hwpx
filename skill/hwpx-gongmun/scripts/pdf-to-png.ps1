# Render each page of a PDF to PNG with the built-in Windows PDF renderer.
# Called by hwp-preview.ps1 in a fresh process: after Hancom COM runs in a process,
# Windows.Data.Pdf silently returns nothing there.
#   powershell -ExecutionPolicy Bypass -File pdf-to-png.ps1 -Pdf file.pdf -OutDir dir [-Scale 1.2]
param(
  [Parameter(Mandatory = $true)][string]$Pdf,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [double]$Scale = 1.2
)
$ErrorActionPreference = 'Stop'
$Pdf = (Resolve-Path $Pdf).Path
New-Item -ItemType Directory -Force $OutDir | Out-Null
$OutDir = (Resolve-Path $OutDir).Path

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$ext = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 }
$opTask = $ext | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$actTask = $ext | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' } | Select-Object -First 1
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]

# Wait until whoever wrote the PDF has released it.
for ($try = 0; $try -lt 40; $try++) {
  try { $h = [IO.File]::Open($Pdf, 'Open', 'Read', 'None'); $h.Close(); break } catch { Start-Sleep -Milliseconds 250 }
}

$t = $opTask.MakeGenericMethod([Windows.Storage.StorageFile]).Invoke($null, @([Windows.Storage.StorageFile]::GetFileFromPathAsync($Pdf)))
$null = $t.Wait(); $file = $t.Result
$t = $opTask.MakeGenericMethod([Windows.Data.Pdf.PdfDocument]).Invoke($null, @([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)))
$null = $t.Wait(); $doc = $t.Result
if ($null -eq $doc) { throw "Could not load PDF: $Pdf" }

for ($i = 0; $i -lt $doc.PageCount; $i++) {
  $page = $doc.GetPage($i)
  $opts = New-Object Windows.Data.Pdf.PdfPageRenderOptions
  $opts.DestinationWidth = [uint32]($page.Size.Width * $Scale)
  $opts.DestinationHeight = [uint32]($page.Size.Height * $Scale)
  $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  $null = $actTask.Invoke($null, @($page.RenderToStreamAsync($stream, $opts))).Wait()
  $png = Join-Path $OutDir ('page{0}.png' -f ($i + 1))
  $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream.GetInputStreamAt(0))
  $fs = [IO.File]::Create($png)
  $net.CopyTo($fs)
  $fs.Close(); $net.Close(); $stream.Dispose(); $page.Dispose()
  "PNG: $png"
}
