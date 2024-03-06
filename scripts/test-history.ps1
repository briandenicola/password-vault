param(
    $url = "http://localhost:7071",
    $key,
    $id
)

Write-Host "Getting History $id ..."

$opts = @{
    Method = "Get"
    ContentType = "application/json"
}

if( $nul -ne $id ) {
    Write-Host "Getting  $id ..."
    if( $url -imatch "localhost" ) {
        $opts.Add('Uri', ("{0}/api/passwords/{1}/history" -f $url,$id))
    }
    else {
        $opts.Add('Uri', ("{0}/api/passwords/{1}/history?code={2}" -f $url,$id,$key))
    }

    Invoke-RestMethod -UseBasicParsing @opts
}
