param(
  [Parameter(Mandatory=$true)][string]$Package,
  [Parameter(Mandatory=$true)][string]$Receipt,
  [Parameter(Mandatory=$true)][string]$Output,
  [switch]$AllowManifestReformat,
  [string]$StagingDirectory
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$allowedFiles = @('manifest.json', 'index.html', 'index.js', 'src/core.js', 'src/i18n.js', 'src/premiereAdapter.js', 'src/projectFile.js')
function Get-BytesHash([byte[]]$Bytes) {
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($algorithm.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant() } finally { $algorithm.Dispose() }
}
$candidate = Get-Content -LiteralPath $Receipt -Raw | ConvertFrom-Json
if ($candidate.receiptVersion -ne 1 -or $candidate.files.Count -ne $allowedFiles.Count) { throw 'Invalid receipt version or file count' }
$identityParts = for ($i = 0; $i -lt $allowedFiles.Count; $i++) {
  $item = $candidate.files[$i]
  if ($item.file -cne $allowedFiles[$i] -or $item.sha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'Receipt allowlist/order/hash mismatch' }
  '{"file":"' + $item.file + '","sha256":"' + $item.sha256 + '"}'
}
$computedIdentity = Get-BytesHash ([Text.Encoding]::UTF8.GetBytes('[' + ($identityParts -join ',') + ']'))
if ($candidate.identity -cne $computedIdentity) { throw 'Receipt identity mismatch' }
if ($candidate.packageKind -ne 'unsigned-developer-zip' -or $candidate.installationQualified -ne $false) { throw 'Invalid qualification in receipt' }
$packagePath = (Resolve-Path -LiteralPath $Package).Path
$packageHash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ([IO.Path]::GetExtension($packagePath) -ieq '.zip' -and $packageHash -cne $candidate.packageSha256) { throw 'Developer ZIP hash mismatch' }
$archive = [System.IO.Compression.ZipFile]::OpenRead($packagePath)
try {
  foreach ($entry in $archive.Entries) {
    if ($entry.FullName -cnotin $allowedFiles -and $entry.FullName -cne 'src/') { throw "Unexpected package entry: $($entry.FullName)" }
  }
  $entries = @($archive.Entries | Where-Object { $_.Name })
  if ($entries.Count -ne $allowedFiles.Count) { throw 'Unexpected package file count' }
  $results = foreach ($item in $candidate.files) {
    $entry = @($entries | Where-Object { $_.FullName -ceq $item.file })
    if ($entry.Count -ne 1) { throw "Missing or duplicate package file: $($item.file)" }
    if ($entry[0].Length -gt 10485760) { throw "Oversize runtime file: $($item.file)" }
    $stream = $entry[0].Open()
    $memory = [System.IO.MemoryStream]::new()
    try { $stream.CopyTo($memory); $bytes = $memory.ToArray() } finally { $stream.Dispose(); $memory.Dispose() }
    $hash = Get-BytesHash $bytes
    $exact = $hash -ceq $item.sha256
    $semantic = $null
    if ($item.file -eq 'manifest.json') {
      $packagedManifest = [Text.Encoding]::UTF8.GetString($bytes).TrimStart([char]0xFEFF) | ConvertFrom-Json
      if ($packagedManifest.id -cne $candidate.pluginId -or $packagedManifest.version -cne $candidate.version) { throw 'Package manifest identity mismatch' }
      if (-not $exact -and $AllowManifestReformat) {
        # Opt-in for UDT CCX JSON formatting. Authenticate staging before comparing.
        # An explicit -StagingDirectory replaces the receipt's absolute path, which goes stale when the project folder moves.
        # The receipt itself is never edited or rebased.
        $stageRoot = if ($StagingDirectory) { $StagingDirectory } else { [string]$candidate.stagingDirectory }
        if (-not $stageRoot -or -not (Test-Path -LiteralPath $stageRoot -PathType Container)) {
          throw "Staging directory not found: $stageRoot. Pass -StagingDirectory <path to a copy of the staged files> when the project folder has moved."
        }
        $stageRoot = (Resolve-Path -LiteralPath $stageRoot).Path
        # Authenticate every allowlisted staged file against the receipt SHA-256 before trusting this stage.
        $stagedBytes = $null
        foreach ($staged in $candidate.files) {
          $stagedPath = Join-Path $stageRoot $staged.file
          if (-not (Test-Path -LiteralPath $stagedPath -PathType Leaf)) { throw "Staged file missing: $($staged.file) in $stageRoot. Pass -StagingDirectory with the receipt's staged files." }
          $bytesOfStaged = [IO.File]::ReadAllBytes($stagedPath)
          if ((Get-BytesHash $bytesOfStaged) -cne $staged.sha256) {
            if ($staged.file -ceq 'manifest.json') { throw 'Staged manifest differs from receipt' }
            throw "Staged file differs from receipt: $($staged.file)"
          }
          if ($staged.file -ceq $item.file) { $stagedBytes = $bytesOfStaged }
        }
        $packaged = $packagedManifest | ConvertTo-Json -Depth 100 -Compress
        $staged = [Text.Encoding]::UTF8.GetString($stagedBytes).TrimStart([char]0xFEFF) | ConvertFrom-Json | ConvertTo-Json -Depth 100 -Compress
        $semantic = $packaged -ceq $staged
      }
    }
    if (-not $exact -and -not $semantic) { throw "Package differs from staging receipt: $($item.file)" }
    [ordered]@{ file=$item.file; sha256=$hash; exactBytes=$exact; manifestValuesEqual=$semantic }
  }
  $result = [ordered]@{
    verifiedAt=(Get-Date).ToUniversalTime().ToString('o')
    pluginId=$candidate.pluginId
    version=$candidate.version
    stagingIdentity=$candidate.identity
    source=$candidate.source
    package=$packagePath
    packageSha256=$packageHash
    developerArchiveHashMatches=($packageHash -ceq $candidate.packageSha256)
    runtimeMatchesStaging=$true
    nativeValidation='NOT_ESTABLISHED_BY_PACKAGING'
    installationQualified=$false
    qualification='Archive integrity only; no native or installation qualification'
    files=@($results)
  }
  $result | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $Output -Encoding utf8
  $result | ConvertTo-Json -Depth 100
} finally { $archive.Dispose() }
