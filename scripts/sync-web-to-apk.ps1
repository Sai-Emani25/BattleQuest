$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "web"
$dst = Join-Path $root "apk\app\src\main\assets\www"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
robocopy $src $dst /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }
Write-Host "Copied web → apk/app/src/main/assets/www"
