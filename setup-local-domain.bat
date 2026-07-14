@echo off
:: Kịch bản tự động gán tên miền ảo (Local Domain) vào hệ thống Windows
:: Cần chạy file này bằng quyền Administrator!

set DOMAIN=rottra.local
set HOSTS_FILE=%windir%\System32\drivers\etc\hosts

echo.
echo Đang kiểm tra quyền Administrator...
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Đã có quyền Administrator.
) else (
    echo [LOI] Vui long chay file nay bang quyen Administrator (Run as Administrator)!
    pause
    exit /b
)

echo.
echo Kiem tra xem %DOMAIN% da co trong file hosts chua...
findstr /i "%DOMAIN%" "%HOSTS_FILE%" >nul
if %errorLevel% == 0 (
    echo [OK] Ten mien %DOMAIN% da ton tai trong file hosts. Khong can them moi.
) else (
    echo [TIEN HANH] Dang them %DOMAIN% vao %HOSTS_FILE%...
    echo. >> "%HOSTS_FILE%"
    echo 127.0.0.1 %DOMAIN% >> "%HOSTS_FILE%"
    echo [XONG] Da them thanh cong!
)

echo.
echo Ban co the truy cap du an qua http://%DOMAIN%:5173
pause
