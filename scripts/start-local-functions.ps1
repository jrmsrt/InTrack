$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$cli = Join-Path $workspace 'node_modules\supabase\dist\supabase.js'
$environmentFile = Join-Path $workspace '.env'
if (!(Test-Path -LiteralPath $cli) -or !(Test-Path -LiteralPath $environmentFile)) {
  throw 'Install the local dependencies and configure .env first.'
}

function Test-LocalFunctions {
  try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:54321/functions/v1/password-change-session' -Method Post -ContentType 'application/json' -Body '{}' -TimeoutSec 5 -UseBasicParsing
    return $false
  } catch {
    return $_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401
  }
}

if (Test-LocalFunctions) {
  Write-Output 'Local password recovery functions are already running.'
  exit 0
}

$node = (Get-Command node).Source
$outputFolder = Join-Path $workspace 'output'
New-Item -ItemType Directory -Path $outputFolder -Force | Out-Null
$process = Start-Process -FilePath $node -ArgumentList @("`"$cli`"", 'functions', 'serve', '--env-file', "`"$environmentFile`"") -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardOutput (Join-Path $outputFolder 'local-functions.stdout.log') -RedirectStandardError (Join-Path $outputFolder 'local-functions.stderr.log') -PassThru
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  if (Test-LocalFunctions) {
    Write-Output "Local password recovery functions are running in the background (process $($process.Id))."
    exit 0
  }
  if ($process.HasExited) { break }
  Start-Sleep -Milliseconds 500
}
throw 'Local functions did not become available. Check the local-functions logs in output.'
