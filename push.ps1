<#
.SYNOPSIS
  把插件仓库推到 GitHub。token 只用于本次推送，不写进 .git/config。

.EXAMPLE
  .\push.ps1 -Repo "yourname/dsh-prompt-ning" -Token $env:GH_TOKEN -Create
#>
param(
  [Parameter(Mandatory = $true)][string]$Repo,
  [Parameter(Mandatory = $true)][string]$Token,
  [string]$Path = "",
  [string]$Branch = "main",
  [string]$Message = "feat: dsh-prompt 0.1.0",
  [switch]$Create,
  [switch]$Public
)

$ErrorActionPreference = "Stop"

if (-not $Path) { $Path = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not (Test-Path -LiteralPath $Path)) { throw "path not found: $Path" }
$Path = (Resolve-Path -LiteralPath $Path).Path
Set-Location -LiteralPath $Path

$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $git) { throw "git not found in PATH" }

if ($Repo -match '^https?://github\.com/([^/]+)/([^/]+?)(\.git)?/?$') {
  $owner = $Matches[1]; $name = $Matches[2]
} elseif ($Repo -match '^([\w.-]+)/([\w.-]+)$') {
  $owner = $Matches[1]; $name = $Matches[2]
} else {
  throw "Repo must be owner/name or https://github.com/owner/name"
}
Write-Host "repo   -> $owner/$name"
Write-Host "branch -> $Branch"
Write-Host "path   -> $Path"

if ($Create) {
  $body = @{ name = $name; private = (-not $Public); auto_init = $false } | ConvertTo-Json
  try {
    Invoke-RestMethod -Method Post -Uri "https://api.github.com/user/repos" `
      -Headers @{ Authorization = "token $Token"; "User-Agent" = "dsh-prompt-push" } `
      -Body $body -ContentType "application/json" | Out-Null
    Write-Host "created repository $owner/$name"
  } catch {
    Write-Host "create skipped: $($_.Exception.Message)"
  }
}

$pkgPath = Join-Path -Path $Path -ChildPath "package.json"
if (Test-Path -LiteralPath $pkgPath) {
  $pkg = [System.IO.File]::ReadAllText($pkgPath, [System.Text.Encoding]::UTF8)
  $pkg = $pkg.Replace("REPO_OWNER", $owner).Replace("REPO_NAME", $name)
  [System.IO.File]::WriteAllText($pkgPath, $pkg, [System.Text.UTF8Encoding]::new($false))
  Write-Host "package.json -> $owner/$name"
}

if (-not (Test-Path -LiteralPath (Join-Path -Path $Path -ChildPath ".git"))) {
  & $git init -b $Branch | Out-Null
  Write-Host "git init -b $Branch"
}

& $git config user.name "dsh-prompt"
& $git config user.email "dsh-prompt@users.noreply.github.com"

$ErrorActionPreference = "Continue"
& $git add -A 2>$null
& $git -c core.autocrlf=false commit -m $Message --quiet 2>$null
Write-Host "commit: $(& $git --no-pager log --oneline -1 2>$null)"

$url = "https://$Token@github.com/$owner/$name.git"
& $git push $url "HEAD:refs/heads/$Branch" 2>&1 | Select-Object -Last 6
if ($LASTEXITCODE -ne 0) {
  Write-Host "retry with --force (empty or diverged remote)"
  & $git push $url "HEAD:refs/heads/$Branch" --force 2>&1 | Select-Object -Last 6
}
if ($LASTEXITCODE -ne 0) { throw "push failed" }

Write-Host ""
Write-Host "done -> https://github.com/$owner/$name"
