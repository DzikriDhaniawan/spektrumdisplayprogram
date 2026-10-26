# Script Pemindai Folder Video untuk Digital Signage
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$videosDir = Join-Path $root "videos"
$outputJs = Join-Path $root "videos-data.js"

if (-not (Test-Path $videosDir)) {
    New-Item -ItemType Directory -Path $videosDir | Out-Null
}

$exts = @("*.mp4", "*.webm", "*.mkv", "*.mov", "*.avi")
$files = Get-ChildItem -Path $videosDir -Include $exts -Recurse -File

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " DIGITAL SIGNAGE - SINKRONISASI VIDEO LOKAL" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Folder Video: $videosDir"

$videoList = @()

foreach ($f in $files) {
    # Relative path dengan forward slash
    $relPath = $f.FullName.Substring($root.Length).TrimStart("\/").Replace("\", "/")
    
    # Kategori berdasarkan subfolder
    $parentDir = Split-Path $f.DirectoryName -Leaf
    $category = if ($f.DirectoryName -ne $videosDir) { $parentDir } else { "Umum" }
    
    # Nama Judul bersih (hilangkan underscore, rapikan spasi berlebih)
    $cleanTitle = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
    $cleanTitle = $cleanTitle -replace "[_]", " "
    $cleanTitle = $cleanTitle -replace "\s+", " "
    $cleanTitle = (Get-Culture).TextInfo.ToTitleCase($cleanTitle.ToLower()).Trim()
    
    $videoObj = [ordered]@{
        title = $cleanTitle
        file = $relPath
        category = $category
        description = $f.Name
    }
    $videoList += $videoObj
}

if ($videoList.Count -gt 0) {
    # Pastikan format JSON selalu berupa Array JavaScript [...]
    if ($videoList.Count -eq 1) {
        $singleJson = $videoList[0] | ConvertTo-Json -Depth 4
        $json = "[`n$singleJson`n]"
    } else {
        $json = $videoList | ConvertTo-Json -Depth 4
    }

    $content = @"
/**
 * DAFTAR VIDEO SIGNAGE OTOMATIS
 * Diperbarui otomatis pada: $(Get-Date -Format 'dd MMMM yyyy HH:mm:ss')
 * Total Video Terdeteksi: $($videoList.Count)
 */
const LOCAL_VIDEOS = $json;
"@
    [System.IO.File]::WriteAllText($outputJs, $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "`n[SUKSES] Berhasil mendeteksi $($videoList.Count) video!" -ForegroundColor Green
    foreach ($v in $videoList) {
        Write-Host " - [$($v.category)] $($v.title)" -ForegroundColor Gray
    }
} else {
    Write-Host "`n[INFO] Folder 'videos' saat ini belum terisi file .mp4." -ForegroundColor Yellow
    Write-Host "Menggunakan data demo agar tampilan menu tetap bisa dites." -ForegroundColor Yellow
}
Write-Host "==========================================`n" -ForegroundColor Cyan
