@echo off
echo 正在开放端口防火墙...
netsh advfirewall firewall add rule name="竞迹计时 8080" dir=in action=allow protocol=TCP localport=8080
netsh advfirewall firewall add rule name="竞迹计时 8443 HTTPS" dir=in action=allow protocol=TCP localport=8443
echo.
echo 完成！
echo 手机访问: https://192.168.1.199:8443
echo 首次打开会提示"不安全"，点"高级"再点"继续访问"即可
echo.
pause
