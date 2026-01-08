$ErrorActionPreference = "Continue"

$NAME  = "hdud-web"
$IMAGE = "hdud-web:dev"
$PORT  = "5173:5173"
$API   = "http://hdud-api:4000"
$NET   = "hdud_data_default"

Write-Host "== HDUD WEB :: stop/remove container (se existir) ==" -ForegroundColor Cyan
try {
  docker rm -f $NAME | Out-Null
} catch {}

Write-Host "== HDUD WEB :: build (VITE_API_BASE=$API) ==" -ForegroundColor Cyan
docker build --no-cache `
  --build-arg VITE_API_BASE=$API `
  -t $IMAGE `
  -f .\docker\Dockerfile .

if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Build falhou. Abortando." -ForegroundColor Red
  exit 1
}

Write-Host "== HDUD WEB :: run ==" -ForegroundColor Cyan
docker run -d `
  --name $NAME `
  --network $NET `
  -p $PORT `
  $IMAGE

Write-Host "== HDUD WEB :: status ==" -ForegroundColor Green
docker ps | findstr $NAME
