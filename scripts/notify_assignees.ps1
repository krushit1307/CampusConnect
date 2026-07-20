$ErrorActionPreference = "Stop"

Write-Host "Fetching open issues with assignees..."
$issuesJson = gh issue list --state open --json number,assignees
$issues = $issuesJson | ConvertFrom-Json

foreach ($issue in $issues) {
    if ($issue.assignees -and $issue.assignees.Count -gt 0) {
        $assigneeLogins = $issue.assignees | ForEach-Object { "@" + $_.login }
        $assigneesString = $assigneeLogins -join ", "
        
        $message = "Hi $assigneesString, please note that our contribution guidelines have been updated. Contributors can now have a maximum of 7 active issues, and you have 3 days to open a PR for your assigned issues."
        
        Write-Host "Commenting on issue #$($issue.number) tagging $assigneesString"
        gh issue comment $issue.number --body $message
    }
}

Write-Host "Finished notifying assignees."
