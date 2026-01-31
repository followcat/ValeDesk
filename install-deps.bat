@echo off
setlocal enabledelayedexpansion

echo [1/5] Checking winget...
where winget >nul 2>nul
if errorlevel 1 (
  echo ERROR: winget not found. Please install App Installer from Microsoft Store.
  exit /b 1
)

echo [2/5] Installing uv (Astral.UV)...
winget install --id Astral.UV --source winget --accept-package-agreements --accept-source-agreements

set "UV_EXE=uv"
where uv >nul 2>nul
if errorlevel 1 (
  if exist "%LOCALAPPDATA%\Programs\uv\uv.exe" (
    set "UV_EXE=%LOCALAPPDATA%\Programs\uv\uv.exe"
  )
)

echo [3/5] Installing Python via uv...
"%UV_EXE%" python install 3.14

echo [4/5] Installing Python PDF->image package...
"%UV_EXE%" pip install pdf2image

echo [5/6] Installing Poppler (required by pdf2image)...
winget install --id oschina.poppler --source winget --accept-package-agreements --accept-source-agreements

echo [6/6] Installing curl and git...
winget install --id Curl.Curl --source winget --accept-package-agreements --accept-source-agreements
winget install --id Git.Git --source winget --accept-package-agreements --accept-source-agreements

echo Done.
