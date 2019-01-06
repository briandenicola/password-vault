$functionDir = "..\Source\functionapp"
$currentDir = $PWD.Path

$process = Get-NetTCPConnection | where { $_.State -eq 'Listen' -and $_.LocalPort -eq '7071' } | Select -Expand OwningProcess

if($process -ne $null ) {
    Stop-Process -id $process -Force 
    Start-Sleep -Seconds 10
}

Set-location -Path $functionDir
func start --cors http://localhost:8080