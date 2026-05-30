$jobs = Invoke-RestMethod -Uri "https://profile-f0umjpath-clintoniremos-projects.vercel.app/api/jobs"
foreach ($job in $jobs) {
    $body = @{ title = $job.title; company = $job.company; url = $job.url } | ConvertTo-Json -Compress
    Write-Host "Applying to $($job.title) at $($job.company)"
    Invoke-RestMethod -Method Post -Uri "https://profile-f0umjpath-clintoniremos-projects.vercel.app/api/apply" -ContentType "application/json" -Body $body
}
