$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$headers = @{ apikey = $env:VERIFY_API_KEY; Authorization = $env:VERIFY_AUTH }
$data = Invoke-RestMethod -TimeoutSec 45 -Uri $env:VERIFY_URL -Headers $headers
ConvertTo-Json -InputObject @($data) -Compress -Depth 30
