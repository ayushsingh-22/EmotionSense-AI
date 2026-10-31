param([Parameter(Mandatory)][string]$BackendUrl, [Parameter(Mandatory)][string]$SiteUrl)
$ErrorActionPreference = 'Stop'
$backend = ([uri]$BackendUrl).GetLeftPart([System.UriPartial]::Authority).TrimEnd('/')
$site = ([uri]$SiteUrl).GetLeftPart([System.UriPartial]::Authority).TrimEnd('/')
if (-not $backend.StartsWith('https://') -or -not $site.StartsWith('https://')) { throw 'Both origins must use HTTPS.' }
function Check([bool]$condition, [string]$name) { if (-not $condition) { throw "FAIL: $name" }; Write-Host "PASS: $name" }
$health = Invoke-WebRequest -UseBasicParsing -Uri "$backend/api/health" -MaximumRedirection 0
$body = $health.Content | ConvertFrom-Json
Check ($health.StatusCode -eq 200 -and $body.status -eq 'healthy') 'backend health'
Write-Host "Environment: $($body.environment); commit: $($body.commit)"
Check (-not [string]::IsNullOrWhiteSpace($health.Headers['Strict-Transport-Security'])) 'HSTS header'
$preflight = Invoke-WebRequest -UseBasicParsing -Method Options -Uri "$backend/api/auth/login" -Headers @{ Origin=$site; 'Access-Control-Request-Method'='POST'; 'Access-Control-Request-Headers'='content-type' } -MaximumRedirection 0
Check ($preflight.Headers['Access-Control-Allow-Origin'] -eq $site) 'site CORS preflight'
function Status([string]$uri, [string]$method, [string]$json = '') {
  try { if ($method -eq 'POST') { return (Invoke-WebRequest -UseBasicParsing -Method POST -Uri $uri -ContentType 'application/json' -Body $json -MaximumRedirection 0).StatusCode }; return (Invoke-WebRequest -UseBasicParsing -Uri $uri -MaximumRedirection 0).StatusCode }
  catch { if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }; throw }
}
Check ((Status "$backend/api/auth/me" 'GET') -eq 401) 'anonymous protected route'
Check ((Status "$backend/api/auth/login" 'POST' '{}') -eq 401) 'login route reachable'
Check ((Status "$backend/api/auth/verify-email" 'POST' '{}') -eq 400) 'verification route reachable'
$siteResponse = Invoke-WebRequest -UseBasicParsing -Uri $site -MaximumRedirection 0
Check ($siteResponse.StatusCode -eq 200) 'website reachable'
