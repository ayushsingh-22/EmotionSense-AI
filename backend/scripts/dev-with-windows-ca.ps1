# Local development only: let Node trust the Kaspersky root already trusted by Windows.
# This does not change the Windows trust store or disable TLS verification.
$ErrorActionPreference = 'Stop'
$roots = @(Get-ChildItem Cert:\CurrentUser\Root | Where-Object {
    $_.Subject -match 'Kaspersky Anti-Virus Personal Root Certificate' -and
    $_.Subject -eq $_.Issuer -and $_.NotAfter -gt (Get-Date) -and
    ($_.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.19' -and $_.CertificateAuthority })
})
if ($roots.Count -ne 1) { throw 'Expected exactly one unexpired, trusted Kaspersky root in the current-user Windows certificate store.' }
if ($env:NODE_EXTRA_CA_CERTS) { throw 'NODE_EXTRA_CA_CERTS is already configured. Review existing trust configuration before running this helper.' }
$pemPath = Join-Path $env:TEMP ('mindhaven-local-root-' + [guid]::NewGuid().ToString() + '.pem')
try {
    $bytes = $roots[0].Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    $base64 = [Convert]::ToBase64String($bytes, 'InsertLineBreaks')
    [IO.File]::WriteAllText($pemPath, "-----BEGIN CERTIFICATE-----`n$base64`n-----END CERTIFICATE-----`n", [Text.Encoding]::ASCII)
    $env:NODE_EXTRA_CA_CERTS = $pemPath
    Write-Host 'Starting backend with the existing Windows-trusted Kaspersky root. TLS verification remains enabled.'
    npm run dev
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Remove-Item Env:NODE_EXTRA_CA_CERTS -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $pemPath) { [IO.File]::Delete($pemPath) }
}
