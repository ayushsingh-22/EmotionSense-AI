# PowerShell script to test emotion detection endpoint
$url = "http://localhost:8080/api/analyze/text"
$body = @{
    text = "i feel sad"
} | ConvertTo-Json

Write-Host "Testing Emotion Detection API..." -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Gray
Write-Host "Body: $body" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json"
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Emotion: $($response.emotion)" -ForegroundColor Yellow
    Write-Host "Confidence: $([math]::Round($response.confidence * 100, 1))%" -ForegroundColor Yellow
    Write-Host "Models Used: $($response.models_used -join ', ')" -ForegroundColor Yellow
    Write-Host ""
    
    if ($response.individual_results) {
        Write-Host "Individual Results:" -ForegroundColor Cyan
        Write-Host "  BiLSTM: $($response.individual_results.bilstm.emotion) ($([math]::Round($response.individual_results.bilstm.confidence * 100, 1))%)"
        Write-Host "  HuggingFace: $($response.individual_results.huggingface.emotion) ($([math]::Round($response.individual_results.huggingface.confidence * 100, 1))%)"
    }
    
    Write-Host ""
    if ($response.models_used -contains "huggingface") {
        Write-Host "✅ HuggingFace model is working!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Only BiLSTM used (HuggingFace may have failed)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
}
