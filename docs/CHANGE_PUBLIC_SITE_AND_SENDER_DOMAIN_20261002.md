# Public Site And Sender Domain Alignment

日期：2026-10-02 · 状态：代码与本地配置已调整；生产 DNS、provider 验证及部署尚未完成。

## 需求解读

将公开网站目标统一为 `https://www.climatepassport.org`。事务邮件发件地址从 `@climatepassport.org` 切换到 `@notice.climatepassport.org`。这项代码变更不等于域名已完成 DNS 指向、Zoho/Resend sender verification 或生产环境更新。

## 修改方法

复用 `lib/seo.ts` 的 `absoluteUrl` 作为 canonical、robots、活动分享 QR 和海报链接的共同 URL 来源；更新运行示例、当前架构说明及本地发件人配置。邮件 provider 的协议实现不变，不读取或更改 provider 密钥，也不发送真实邮件。

## 修改内容

- `NEXT_PUBLIC_SITE_URL` 默认值与 `.env.example` 改为 `https://www.climatepassport.org`；活动分享 QR 和海报详情 URL 使用 `absoluteUrl`。
- `.env.example` 补充认证邮件 origin、credential epoch、worker secret、Zoho 示例 endpoint 和新的 `MAIL_FROM`；密钥留空。
- 本机 `.env` / `.env.local` 的 `MAIL_FROM` 统一为 `no-reply@notice.climatepassport.org`；其他 provider/密钥值保持不变，文件仍由 Git 忽略。
- 根 README、workspace instructions、当前架构文档和邮件传输说明更新为新目标；历史验收记录保留原貌。

## 当前接入检查

- 本机配置快照：根 `.env` 未指定 `MAIL_PROVIDER`，transport 因此按代码默认 Resend；根 `.env.local` 指定 Zoho CPaaS 且配置 endpoint/token。应用部署环境的实际变量来源未核实，部署必须显式设置 `MAIL_PROVIDER`。
- 发送服务有 Resend/Zoho API transport，但认证邮件采用持久 outbox；必须由外部 scheduler 调用 worker。仓库没有 scheduler 配置，邮件端到端接入目前不能判为完成。
- 2026-10-02 DNS 检查：`climatepassport.org` apex 有 Zoho MX/SPF；`notice.climatepassport.org` 没有可见 A/CNAME/TXT；`www.climatepassport.org` 查询返回 NXDOMAIN。新发件域需按所选 provider 配置并验证 SPF/DKIM 等记录；网站需先接通 DNS/CDN/host。
- 未读取密钥值、未调用 provider API、未发邮件、未改生产环境或生产 DNS。`AUTH_PUBLIC_ORIGIN` 在本机仍指向 loopback，保留本地开发行为；部署时需设为 `https://www.climatepassport.org`。