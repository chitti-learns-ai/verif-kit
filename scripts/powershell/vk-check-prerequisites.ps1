# Verif-Kit "where are we?" oracle. Reconstructs verification state from disk in one
# JSON answer — no model memory needed. Mirrors spec-kit's check-prerequisites.ps1.
#   Usage: pwsh vk-check-prerequisites.ps1 -Module price-calculator -Feature 001-checkout -Json
[CmdletBinding()]
param(
  [string]$Module,
  [string]$Feature,
  [switch]$Json
)
. (Join-Path $PSScriptRoot 'vk-common.ps1')

$root = Get-VkRepoRoot
$cfg = Get-VkConfig -RepoRoot $root

if (-not $Feature) {
  $specs = Join-Path $root 'specs'
  if (Test-Path $specs) {
    $first = Get-ChildItem $specs -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($first) { $Feature = $first.Name }
  }
}

$result = [ordered]@{
  repoRoot    = $root
  configFound = [bool]$cfg
  feature     = $Feature
  module      = $Module
}

if ($Module -and $Feature) {
  $p = Resolve-VkPaths -RepoRoot $root -Config $cfg -Feature $Feature -Module $Module
  $cov = Get-VkCoverClosure -VplanPath $p.vplan
  $result.contractExists          = [bool](Test-Path $p.contract)
  $result.vplanExists             = [bool](Test-Path $p.vplan)
  $result.verificationTasksExists = [bool](Test-Path $p.verificationTasks)
  $result.coverPointsTotal        = $cov.total
  $result.coverPointsClosed       = $cov.closed
  $result.firstOpenTask           = Get-VkFirstOpenTask -TasksPath $p.verificationTasks
  $result.resume                  = if ($result.verificationTasksExists) { 'resume at firstOpenTask' } else { 'start fresh (Phase 0)' }
  $result.paths                   = $p
}

if ($Json) { $result | ConvertTo-Json -Depth 6 -Compress } else { $result | ConvertTo-Json -Depth 6 }
