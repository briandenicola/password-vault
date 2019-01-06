$containerName="azure-cosmosdb-emulator"
$hostDirectory="c:\working\azure-cosmosdb-emulator.hostd"

$container =  $(docker ps -aq --filter "name=$containerName")

if($container -ne $null) {
    docker stop $container
    docker rm $container 
    $cosmosContainers = $(docker ps -aq --filter "ancestor=microsoft/$containerName")
    docker stop $cosmosContainers
    docker rm $cosmosContainers
}
docker run --name $containerName --memory 2GB --mount "type=bind,source=$hostDirectory,destination=C:\CosmosDB.Emulator\bind-mount" -P -it microsoft/azure-cosmosdb-emulator
docker run -v $ENV:LOCALAPPDATA\CosmosDBEmulatorCert:C:\CosmosDB.Emulator\CosmosDBEmulatorCert -P -i -m 2GB microsoft/azure-cosmosdb-emulator
docker ps --filter "name=$containerName"