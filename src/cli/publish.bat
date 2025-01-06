@echo off

dotnet publish -c Release -r win10-x64 --self-contained --nologo -o publish -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
