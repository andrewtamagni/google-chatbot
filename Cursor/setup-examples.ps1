# PowerShell script to set up all reference repositories
# Run this from your project root directory

Write-Host "Setting up Reference Repositories..." -ForegroundColor Cyan
Write-Host "This script will check for and clone three repositories:" -ForegroundColor Cyan
Write-Host "  1. Google Apps Script Samples" -ForegroundColor White
Write-Host "  2. EIP Chatbot" -ForegroundColor White
Write-Host "  3. EIP AI Search Update" -ForegroundColor White

# Get the parent directory (where repos should be located)
# Since this script is in Cursor/, we need to go up two levels to get to the Github directory
$projectRoot = Split-Path -Parent $PSScriptRoot
$parentDir = Split-Path -Parent $projectRoot
$workspaceFile = Join-Path $PSScriptRoot "ito-google-chatbot.code-workspace"

# Define repositories to check/clone
$repos = @(
    @{
        Name = "apps-script-samples"
        Url = "https://github.com/googleworkspace/apps-script-samples.git"
        Description = "Google Apps Script Examples"
    },
    @{
        Name = "eipchatbot"
        Url = "https://github.com/yourorg/eipchatbot.git"
        Description = "EIP Chatbot - Azure OpenAI Chatbot"
    },
    @{
        Name = "eip-ai-search-update"
        Url = "https://github.com/andrewtamagni/ai-search-update.git"
        Description = "EIP AI Search Update - Index Management"
    }
)

# Check and clone each repository
$existingRepos = @()
$clonedRepos = @()
$missingRepos = @()

foreach ($repo in $repos) {
    $repoDir = Join-Path $parentDir $repo.Name
    
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "Repository: $($repo.Description)" -ForegroundColor Cyan
    Write-Host "Location: $repoDir" -ForegroundColor Gray
    
    # Check if repository already exists in parent directory
    if (Test-Path $repoDir) {
        Write-Host "✅ Repository already exists" -ForegroundColor Green
        Write-Host "   Skipping clone - using existing directory" -ForegroundColor Gray
        $existingRepos += $repo
    } else {
        Write-Host "📥 Repository not found - cloning..." -ForegroundColor Yellow
        Write-Host "   URL: $($repo.Url)" -ForegroundColor Gray
        
        try {
            Set-Location $parentDir
            git clone $repo.Url
            Write-Host "✅ Successfully cloned!" -ForegroundColor Green
            $clonedRepos += $repo
        } catch {
            Write-Host "❌ Error cloning repository: $_" -ForegroundColor Red
            Write-Host "   Please ensure git is installed and you have internet access." -ForegroundColor Yellow
            $missingRepos += $repo
        }
    }
}

# Update workspace file to ensure all existing repos are included
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Verifying workspace configuration..." -ForegroundColor Cyan

try {
    # Read and parse workspace file
    $workspaceContent = Get-Content $workspaceFile -Raw | ConvertFrom-Json
    
    # Get list of repo paths that should be in workspace
    # Since workspace file is in Cursor/, paths are relative to that location
    $expectedPaths = @("..")
    foreach ($repo in $repos) {
        $relativePath = "../../$($repo.Name)"
        $expectedPaths += $relativePath
    }
    
    # Check which paths are missing from workspace
    $workspacePaths = $workspaceContent.folders | ForEach-Object { $_.path }
    $missingPaths = @()
    
    foreach ($expectedPath in $expectedPaths) {
        if ($expectedPath -notin $workspacePaths) {
            $missingPaths += $expectedPath
        }
    }
    
    if ($missingPaths.Count -gt 0) {
        Write-Host "   Adding missing paths to workspace..." -ForegroundColor Yellow
        foreach ($path in $missingPaths) {
            Write-Host "     + $path" -ForegroundColor Gray
            # Add as PSCustomObject to match existing structure
            $newFolder = [PSCustomObject]@{ path = $path }
            $workspaceContent.folders = $workspaceContent.folders + $newFolder
        }
        
        # Convert to JSON with tabs for indentation
        $jsonContent = $workspaceContent | ConvertTo-Json -Depth 10
        # Replace 2-space indentation with tabs
        $jsonContent = $jsonContent -replace '(?m)^(  )+', { param($m) "`t" * ($m.Value.Length / 2) }
        
        Set-Content -Path $workspaceFile -Value $jsonContent
        Write-Host "✅ Workspace file updated!" -ForegroundColor Green
    } else {
        Write-Host "✅ Workspace file already includes all repositories" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Could not update workspace file: $_" -ForegroundColor Yellow
    Write-Host "   The workspace file may need manual editing" -ForegroundColor Yellow
    Write-Host "   Expected repository paths:" -ForegroundColor Gray
    Write-Host "     - .. (project root)" -ForegroundColor Gray
    foreach ($repo in $repos) {
        Write-Host "     - ../../$($repo.Name)" -ForegroundColor Gray
    }
}

# Summary
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "`n📁 Repository Summary:" -ForegroundColor Cyan

if ($existingRepos.Count -gt 0) {
    Write-Host "`n✅ Existing Repositories (not cloned):" -ForegroundColor Green
    foreach ($repo in $existingRepos) {
        $repoPath = Join-Path $parentDir $repo.Name
        Write-Host "   ✓ $($repo.Description) - $repoPath" -ForegroundColor Gray
    }
}

if ($clonedRepos.Count -gt 0) {
    Write-Host "`n📥 Newly Cloned Repositories:" -ForegroundColor Green
    foreach ($repo in $clonedRepos) {
        $repoPath = Join-Path $parentDir $repo.Name
        Write-Host "   ✓ $($repo.Description) - $repoPath" -ForegroundColor Green
    }
}

if ($missingRepos.Count -gt 0) {
    Write-Host "`n❌ Failed to Clone:" -ForegroundColor Red
    foreach ($repo in $missingRepos) {
        Write-Host "   ✗ $($repo.Description)" -ForegroundColor Red
    }
}

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Open Cursor" -ForegroundColor White
Write-Host "2. Open your workspace file: Cursor/ito-google-chatbot.code-workspace" -ForegroundColor White
Write-Host "   (All repositories are automatically included in the workspace)" -ForegroundColor Gray

Write-Host "`n💡 Using in Cursor Agent:" -ForegroundColor Yellow
Write-Host "- Press Ctrl+I to open Agent mode" -ForegroundColor White
Write-Host "- Use @ mentions like:" -ForegroundColor White
Write-Host "  • @apps-script-samples/chat/your-file.js" -ForegroundColor Gray
Write-Host "  • @eipchatbot/app.py" -ForegroundColor Gray
Write-Host "  • @eip-ai-search-update/aiIndexUpdate_V2.py" -ForegroundColor Gray
Write-Host "- Reference examples: 'How does the Chat example handle onMessage?'" -ForegroundColor White

Write-Host "`n✨ Setup complete!" -ForegroundColor Green

