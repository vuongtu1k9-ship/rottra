@echo off
if not exist bin mkdir bin

set COMPILER=C:\mingw64\bin\g++.exe

if not exist "%COMPILER%" (
    echo [ERROR] Cannot find compiler at %COMPILER%
    exit /b 1
)

echo [BUILD] Compiling C++ Native AI Hub...
"%COMPILER%" -O3 -std=c++17 -static -static-libgcc -static-libstdc++ src\native\ai-hub\main.cpp -o bin\ai_core.exe

if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    exit /b %errorlevel%
)

echo [SUCCESS] Built successfully at bin\ai_core.exe
