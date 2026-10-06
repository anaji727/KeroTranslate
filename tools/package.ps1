$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$artifactDirectory = Join-Path $repoRoot 'artifacts'
New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
Compress-Archive -Path (Join-Path $repoRoot 'extension/*') -DestinationPath (Join-Path $artifactDirectory 'KeroTranslate-Extension.zip') -Force
Write-Output 'Extension archive created in artifacts/.'
