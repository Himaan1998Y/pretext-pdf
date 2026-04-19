# Run once to register a Windows scheduled task that auto-fetches master every 30 min.
# Run with: powershell -ExecutionPolicy Bypass -File scripts/setup-auto-pull.ps1

$repoPath = "F:\Antigravity\brain\projects\pretext-pdf"
$action   = New-ScheduledTaskAction -Execute "git" -Argument "fetch origin master" -WorkingDirectory $repoPath
$trigger  = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 30) -Once -At (Get-Date)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -StartWhenAvailable

Register-ScheduledTask `
  -TaskName   "pretext-pdf auto-fetch" `
  -Action     $action `
  -Trigger    $trigger `
  -Settings   $settings `
  -RunLevel   Limited `
  -Force

Write-Host "Scheduled task registered. git fetch origin master will run every 30 minutes."
Write-Host "To remove: Unregister-ScheduledTask -TaskName 'pretext-pdf auto-fetch' -Confirm:`$false"
