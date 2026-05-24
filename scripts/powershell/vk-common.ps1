# Verif-Kit shared PowerShell library (mirrors spec-kit's common.ps1 idea).
# Slash-command prompts never hard-code paths; they call these resolvers and
# parse the JSON. Dot-source this from the other vk-*.ps1 scripts.

$ErrorActionPreference = 'Stop'

# Find the project root by walking UP for a verif-kit marker (NOT git first, so a
# sub-project inside a larger repo still resolves correctly).
function Get-VkRepoRoot {
  $dir = (Get-Location).Path
  while ($true) {
    if (Test-Path (Join-Path $dir 'verif-kit.config.json')) { return $dir }
    if (Test-Path (Join-Path $dir '.verif-kit')) { return $dir }
    if (Test-Path (Join-Path $dir '.git')) { return $dir }
    $parent = Split-Path $dir -Parent
    if ([string]::IsNullOrEmpty($parent) -or $parent -eq $dir) { break }
    $dir = $parent
  }
  return (Get-Location).Path
}

function Get-VkConfig {
  param([string]$RepoRoot)
  $cfgPath = Join-Path $RepoRoot 'verif-kit.config.json'
  if (Test-Path $cfgPath) { return (Get-Content $cfgPath -Raw | ConvertFrom-Json) }
  return $null
}

# Resolve the per-module verification artifact paths from config (or sane defaults).
function Resolve-VkPaths {
  param([string]$RepoRoot, $Config, [string]$Feature, [string]$Module)
  $vdir = if ($Config -and $Config.paths.verificationDir) { $Config.paths.verificationDir } else { 'specs/{feature}/verification' }
  $vdir = $vdir.Replace('{feature}', $Feature)
  $base = Join-Path $RepoRoot $vdir
  return [ordered]@{
    verificationDir   = $base
    contract          = Join-Path $base "$Module.contract.md"
    vplan             = Join-Path $base "$Module.vplan.md"
    verificationTasks = Join-Path $base "$Module.verification-tasks.md"
  }
}

# Count cover-point closure in a vplan: total V### lines vs those ticked [x].
function Get-VkCoverClosure {
  param([string]$VplanPath)
  if (-not (Test-Path $VplanPath)) { return @{ total = 0; closed = 0 } }
  $lines  = Get-Content $VplanPath
  $total  = ($lines | Where-Object { $_ -match '^\s*-\s*\[[ xX]\]\s*V\d' }).Count
  $closed = ($lines | Where-Object { $_ -match '^\s*-\s*\[[xX]\]\s*V\d'  }).Count
  return @{ total = $total; closed = $closed }
}

# The first unchecked VT line in a verification-tasks file (the resume point).
function Get-VkFirstOpenTask {
  param([string]$TasksPath)
  if (-not (Test-Path $TasksPath)) { return $null }
  foreach ($l in Get-Content $TasksPath) {
    if ($l -match '^\s*-\s*\[ \]\s*(VT\d+.*)$') { return $Matches[1].Trim() }
  }
  return $null
}
