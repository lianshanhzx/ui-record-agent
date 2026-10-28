@echo off
rem ============================================================
rem  Project-local OpenCode CLI launcher for ui-agent1
rem  (no global PATH changes; ASCII-only on purpose - cmd.exe
rem   reads .cmd files with the OEM codepage)
rem
rem  Usage:
rem    .\opencode                 open TUI in this project
rem    .\opencode run "..."       one-shot, args passed through
rem    .\opencode models          any subcommand
rem
rem  opencode-cli.exe comes from the local desktop install and
rem  shares the same background service/config as the desktop app.
rem ============================================================
setlocal
set "OC_CLI=%LOCALAPPDATA%\Programs\@opencodedesktop\resources\opencode-cli.exe"
if not exist "%OC_CLI%" set "OC_CLI=C:\Users\hzx\AppData\Local\Programs\@opencodedesktop\resources\opencode-cli.exe"
if not exist "%OC_CLI%" (
  echo [ERROR] opencode CLI not found: %OC_CLI%
  echo         Check the desktop install or edit OC_CLI in this script.
  exit /b 1
)

if "%~1"=="" (
  "%OC_CLI%" "%~dp0."
) else (
  "%OC_CLI%" %*
)
endlocal
