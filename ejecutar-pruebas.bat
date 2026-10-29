@echo off
chcp 65001 >nul
title Pruebas unitarias - Software web ESPM
echo ================================================
echo  Pruebas unitarias del software web ESPM
echo ================================================
echo.
if not exist node_modules (
  echo Instalando las librerias por primera vez. Esto puede tardar un momento...
  call npm.cmd install
  echo.
)
call npm.cmd test
echo.
pause
