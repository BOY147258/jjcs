@echo off
:: jjcs 一键部署 — 同步根目录到 /docs 并推送到 GitHub Pages
echo [jjcs] 同步文件到 docs/...

xcopy /Y /Q index.html docs\
xcopy /Y /Q admin.html docs\
xcopy /Y /Q sw.js docs\
xcopy /Y /Q manifest.json docs\
xcopy /Y /E /Q /I css docs\css
xcopy /Y /E /Q /I js docs\js
xcopy /Y /E /Q /I icons docs\icons

echo [jjcs] 提交并推送...
git add docs/
git add index.html admin.html js/ css/ sw.js manifest.json
git diff --cached --quiet && echo [jjcs] 没有变更需要提交 && goto :eof
git commit -m "deploy: sync docs and push"
git push origin main
echo [jjcs] 部署完成！ https://boy147258.github.io/jjcs/
