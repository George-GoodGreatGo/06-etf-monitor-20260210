param([string]$OutputDirectory = 'tmp')
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -PathType Container $OutputDirectory)) { throw 'Output directory must exist' }
foreach ($ticker in @('SCHD', 'VYM', 'VIG', 'VGT', 'VOO', 'QQQM', 'SMH')) {
  $url = "https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5y&interval=1d&includeAdjustedClose=true"
  Invoke-WebRequest -UseBasicParsing -TimeoutSec 30 -Uri $url -OutFile (Join-Path $OutputDirectory "$ticker.local.json")
  Write-Output "$ticker downloaded"
}
Write-Output "Run: npm run refresh:supabase:us-market-style -- --input-dir $OutputDirectory --dry-run"
