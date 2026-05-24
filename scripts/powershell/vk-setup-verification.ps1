# Verif-Kit setup: create the verification artifact dir for a module and seed the
# ticking checklists from templates. Emits JSON paths. Mirrors setup-tasks.ps1.
#   Usage: pwsh vk-setup-verification.ps1 -Module price-calculator -Feature 001-checkout -Json
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Module,
  [Parameter(Mandatory)][string]$Feature,
  [switch]$Json
)
. (Join-Path $PSScriptRoot 'vk-common.ps1')

$root = Get-VkRepoRoot
$cfg = Get-VkConfig -RepoRoot $root
$p = Resolve-VkPaths -RepoRoot $root -Config $cfg -Feature $Feature -Module $Module
New-Item -ItemType Directory -Force -Path $p.verificationDir | Out-Null

# Template source: prefer the installed location, fall back to the source package.
$tplDir = $null
foreach ($cand in @('.specify/templates', '.verif-kit/templates', 'verif-kit/templates')) {
  $cp = Join-Path $root $cand
  if (Test-Path $cp) { $tplDir = $cp; break }
}

function Copy-IfAbsent($srcName, $dest) {
  if ((Test-Path $dest) -or (-not $tplDir)) { return }
  $src = Join-Path $tplDir $srcName
  if (Test-Path $src) {
    (Get-Content $src -Raw).Replace('[MODULE]', $Module) | Set-Content -Path $dest -Encoding utf8
  }
}

Copy-IfAbsent 'verification-tasks-template.md' $p.verificationTasks
Copy-IfAbsent 'vplan-template.md' $p.vplan
Copy-IfAbsent 'verification-contract-template.md' $p.contract

$out = [ordered]@{ created = $true; templatesFrom = $tplDir; paths = $p }
if ($Json) { $out | ConvertTo-Json -Depth 6 -Compress } else { $out | ConvertTo-Json -Depth 6 }
