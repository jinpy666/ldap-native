Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = Resolve-Path (Join-Path $PSScriptRoot '..')
$ArtifactDir = if ($env:GSSAPI_WINDOWS_ARTIFACT_DIR) {
  $env:GSSAPI_WINDOWS_ARTIFACT_DIR
} else {
  Join-Path $RootDir 'artifacts/gssapi-windows'
}

function Require-Env {
  param([string]$Name)
  $Value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "missing required environment variable: $Name"
  }
  return $Value
}

$IsWindowsVariable = Get-Variable -Name IsWindows -ErrorAction SilentlyContinue
$IsWindowsRuntime = if ($null -ne $IsWindowsVariable) {
  [bool]$IsWindowsVariable.Value
} else {
  [System.Environment]::OSVersion.Platform -eq 'Win32NT'
}

if (-not $IsWindowsRuntime) {
  throw 'verify-gssapi-windows.ps1 must be run on Windows'
}

New-Item -ItemType Directory -Force -Path $ArtifactDir | Out-Null

$null = Require-Env 'LDAP_URL'
$null = Require-Env 'LDAP_BASE_DN'

$nodeOutputPath = Join-Path $ArtifactDir 'ldap-native-windows.out'
$testOutputPath = Join-Path $ArtifactDir 'windows-gssapi-test.out'
$reportPath = Join-Path $ArtifactDir 'REPORT.md'

$nodeOutput = & node (Join-Path $RootDir 'examples/gssapi-windows.cjs') 2>&1
$nodeExitCode = $LASTEXITCODE
$nodeOutput | Tee-Object -FilePath $nodeOutputPath

$env:LDAP_GSSAPI_WINDOWS = '1'
$testOutput = & node --test (Join-Path $RootDir 'tests/integration/windows-gssapi.integration.test.cjs') 2>&1
$testExitCode = $LASTEXITCODE
$testOutput | Tee-Object -FilePath $testOutputPath

@"
# Windows GSSAPI Report

- example: examples/gssapi-windows.cjs
- node_exit_code: $nodeExitCode
- ldap_output: ldap-native-windows.out
- test: tests/integration/windows-gssapi.integration.test.cjs
- test_exit_code: $testExitCode
- test_output: windows-gssapi-test.out

The Windows path uses Wldap32 SSPI/Negotiate for GSSAPI. If LDAP_GSSAPI_USER
and LDAP_GSSAPI_PASSWORD are omitted, the current Windows logon credentials are
used.
"@ | Set-Content -Path $reportPath -Encoding UTF8

if ($nodeExitCode -ne 0) {
  throw "examples/gssapi-windows.cjs failed with exit code $nodeExitCode"
}

if ($testExitCode -ne 0) {
  throw "windows-gssapi.integration.test.cjs failed with exit code $testExitCode"
}
