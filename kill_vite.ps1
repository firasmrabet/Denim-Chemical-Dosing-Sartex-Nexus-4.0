$conns = Get-NetTCPConnection -LocalPort 8082 -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    if ($c.OwningProcess) {
        Write-Host "Killing process $($c.OwningProcess) on port 8082"
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "Done"
