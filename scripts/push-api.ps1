<#
.SYNOPSIS
  通过 GitHub API 推送（git push 走不通时的替代通道）。
  github.com:443 被墙 / 超时时用这个：api.github.com 通常仍然可达。

  用 Git Data API：blobs -> tree -> commit -> 更新 ref。
  首次推送（空仓库）与增量推送都支持；已存在同名分支时按 fast-forward 追加一个提交。

.EXAMPLE
  .\push-api.ps1 -Owner chongchong0308 -Repo dsh-prompt-ning -Token $env:GH_TOKEN
#>
param(
  [Parameter(Mandatory = $true)][string]$Owner,
  [Parameter(Mandatory = $true)][string]$Repo,
  [Parameter(Mandatory = $true)][string]$Token,
  [string]$Path = "",
  [string]$Branch = "main",
  [string]$Message = "feat: dsh-prompt 0.1.0"
)

$ErrorActionPreference = "Stop"
if (-not $Path) { $Path = Split-Path -Parent $MyInvocation.MyCommand.Path }
$Path = (Resolve-Path -LiteralPath $Path).Path

$api = "https://api.github.com"
$headers = @{
  Authorization          = "token $Token"
  Accept                 = "application/vnd.github+json"
  "User-Agent"           = "dsh-prompt-api"
  "X-GitHub-Api-Version" = "2022-11-28"
}

function Invoke-Gh($method, $uri, $body) {
  $params = @{ Method = $method; Uri = "$api$uri"; Headers = $headers }
  if ($null -ne $body) {
    $params.Body = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 10 -Compress))
    $params.ContentType = "application/json; charset=utf-8"
  }
  Invoke-RestMethod @params
}

# 0) 仓库与当前分支
$repoInfo = Invoke-Gh GET "/repos/$Owner/$Repo"
Write-Host "repo     -> $($repoInfo.full_name)  private=$($repoInfo.private)  default=$($repoInfo.default_branch)"

$parentSha = $null
$baseTree = $null
try {
  $ref = Invoke-Gh GET "/repos/$Owner/$Repo/git/ref/heads/$Branch"
  $parentSha = $ref.object.sha
  $commit = Invoke-Gh GET "/repos/$Owner/$Repo/git/commits/$parentSha"
  $baseTree = $commit.tree.sha
  Write-Host "parent   -> $parentSha (tree $baseTree)"
} catch {
  Write-Host "parent   -> none (first push)"
}

# 1) 收集文件（跳过 .git）
$root = $Path
$files = Get-ChildItem -LiteralPath $root -Recurse -File -Force |
  Where-Object { $_.FullName -notmatch '\\\.git\\' -and $_.FullName -notmatch '\\\.tmp\\' }
Write-Host "files    -> $($files.Count)"

$entries = @()
$n = 0
foreach ($f in $files) {
  $n += 1
  $rel = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
  $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($f.FullName))
  $blob = Invoke-Gh POST "/repos/$Owner/$Repo/git/blobs" @{ content = $b64; encoding = "base64" }
  $entries += @{ path = $rel; mode = "100644"; type = "blob"; sha = $blob.sha }
  Write-Progress -Activity "uploading blobs" -Status $rel -PercentComplete (($n / $files.Count) * 100)
}
Write-Progress -Activity "uploading blobs" -Completed

# 2) tree
$treeBody = @{ tree = $entries }
if ($baseTree) { $treeBody.base_tree = $baseTree }
$tree = Invoke-Gh POST "/repos/$Owner/$Repo/git/trees" $treeBody
Write-Host "tree     -> $($tree.sha)"

# 3) commit
$commitBody = @{ message = $Message; tree = $tree.sha }
if ($parentSha) { $commitBody.parents = @($parentSha) }
$newCommit = Invoke-Gh POST "/repos/$Owner/$Repo/git/commits" $commitBody
Write-Host "commit   -> $($newCommit.sha)"

# 4) ref
if ($parentSha) {
  Invoke-Gh PATCH "/repos/$Owner/$Repo/git/refs/heads/$Branch" @{ sha = $newCommit.sha; force = $false } | Out-Null
} else {
  Invoke-Gh POST "/repos/$Owner/$Repo/git/refs" @{ ref = "refs/heads/$Branch"; sha = $newCommit.sha } | Out-Null
}
Write-Host "ref      -> refs/heads/$Branch"

# 5) 回读校验
$check = Invoke-Gh GET "/repos/$Owner/$Repo/git/trees/$($tree.sha)?recursive=1"
Write-Host "verify   -> $($check.tree.Count) entries in remote tree"
Write-Host ""
Write-Host "done -> https://github.com/$Owner/$Repo"
