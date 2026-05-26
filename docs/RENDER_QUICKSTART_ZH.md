# jjcs 固定公网部署快速手册

目标：让任何手机、任何网络都能打开同一个固定网址使用 jjcs。

## 最快路径

打开这个部署入口：

```text
https://render.com/deploy?repo=https://github.com/BOY147258/jjcs
```

Render 会读取仓库里的 `render.yaml`，自动创建一个 Node Web 服务。

## 你需要确认的内容

1. 登录 Render，并授权访问 GitHub 仓库 `BOY147258/jjcs`。
2. 使用 Blueprint 部署。
3. `ADMIN_TOKEN` 填一个只有你知道的管理令牌。
4. `ALLOWED_ORIGINS` 可以先留空；绑定正式域名后再填正式域名。
5. 等部署完成，打开 Render 给出的 `onrender.com` 地址。

默认配置使用 Render 免费实例，目的是先把公网固定网址跑通，不需要先绑卡。免费实例空闲后可能休眠，文件系统也不是长期持久保存。

正式比赛前建议升级为付费实例并添加持久磁盘：

- mount path: `/opt/render/project/src/data`
- size: `1 GB`
- 环境变量：`DATA_DIR=/opt/render/project/src/data`

## 验证

部署成功后测试：

```text
https://你的服务.onrender.com/ping
```

看到类似下面内容就说明服务在线：

```json
{"serverTime":1779758706485}
```

再打开：

```text
https://你的服务.onrender.com/admin
```

进入“系统概览”，应该能看到在线房间监控区域。删除成绩等写入操作仍需要先保存 `ADMIN_TOKEN`。

## 普通用户怎么用

普通用户只打开公网首页：

```text
https://你的服务.onrender.com
```

发令端选择“发令端”后会生成：

- 终点端链接
- 成绩端链接
- 终点端二维码
- 成绩端二维码

其他手机扫码即可加入，不需要输入服务器地址，不需要输入管理员令牌。

## 固定域名

Render 服务跑通后，在 Render 的 Custom Domains 里添加你的域名，例如：

```text
jjcs.example.com
```

然后去域名服务商那里按 Render 提示添加 DNS 记录。HTTPS 证书生效后，所有学校只需要打开这个固定域名。

## 注意

- 不要再用 `localhost` 或局域网 IP 给外校使用。
- 临时隧道只适合测试。
- 正式比赛前必须提前测试发令端、终点端、成绩端三类设备。
- 当前版本是辅助计时系统，不应宣称为官方认证电子计时设备。
