@echo off
"C:\Users\L\rottra-db\pgsql\bin\pg_ctl.exe" -D "C:\Users\L\rottra-db\pgsql\data" -l "C:\Users\L\rottra-db\pgsql\data\server.log" -o "-F -p 5435" start
