$prs = gh pr list --state merged --json number,labels --limit 200 | ConvertFrom-Json

$labels = @("good-issue", "good-pr", "good-ui", "good-backend")

foreach ($pr in $prs) {
    if ($pr.labels.Count -eq 0) {
        $pr_number = $pr.number
        $random_index = Get-Random -Maximum $labels.Length
        $selected_label = $labels[$random_index]
        
        Write-Host "PR #$pr_number has no labels. Adding ECSoC26 and $selected_label..."
        gh pr edit $pr_number --add-label "ECSoC26,$selected_label"
    }
}
Write-Host "Done backfilling labels!"
