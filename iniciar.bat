@echo off
chcp 65001 >nul
title Software web ESPM - Pagos, quejas y administracion
echo ================================================
echo  Software web ESPM Moniquira
echo ================================================
echo.
if not exist node_modules (
  echo Instalando las librerias por primera vez. Esto puede tardar un momento...
  call npm.cmd install
  echo.
)
echo Encendiendo el servidor. Para apagarlo cierre esta ventana o presione Ctrl + C.
echo El navegador se abrira en http://localhost:3000
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
call npm.cmd start
echo.
pause
