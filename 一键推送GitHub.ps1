# ===== 江苏省奶龙中学 · 一键推送到 GitHub =====
# 用法：先在 GitHub 网页新建空仓库（建议命名 cxy071201.github.io，Public），
#      然后右键本文件 -> “使用 PowerShell 运行”，或在此文件夹打开 PowerShell 执行：
#          powershell -ExecutionPolicy Bypass -File 一键推送GitHub.ps1
# 第一次运行会要求登录 GitHub（弹出窗口输入账号或授权），之后推送就自动了。

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if (-not (Test-Path ".git")) {
  git init 2>$null | Out-Null
  git add -A
  git commit -m "init: 江苏省奶龙中学 学生社区"
  Write-Host "已初始化本地仓库并提交。" -ForegroundColor Green
}

# 检查是否已有远程仓库地址
$remote = git remote get-url origin 2>$null
if (-not $remote) {
  $url = Read-Host "粘贴你的 GitHub 仓库地址（形如 https://github.com/cxy071201/cxy071201.github.io.git）"
  if ($url -match "https://github.com/") {
    git remote add origin $url
    Write-Host "已添加远程仓库。" -ForegroundColor Green
  } else {
    Write-Host "地址格式不对，请重新运行。应为 https://github.com/用户名/仓库名.git" -ForegroundColor Red
    exit 1
  }
}

Write-Host "正在推送到 GitHub..." -ForegroundColor Cyan
git push -u origin main 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "" -ForegroundColor Green
  Write-Host "✅ 推送成功！" -ForegroundColor Green
  Write-Host "下一步：去仓库 Settings -> Pages，Source 选 main /(root) 并 Save，等 1~2 分钟即可。"
} else {
  Write-Host "推送失败。若是登录/授权问题，请先安装 GitHub Desktop 登录，或在浏览器登录 github.com 后重试。" -ForegroundColor Yellow
}
