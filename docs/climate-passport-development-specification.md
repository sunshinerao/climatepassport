# Climate Passport 开发说明书

> 文件建议路径：`docs/climate-passport-development-specification.md`  
> 适用对象：创始团队、产品经理、UI/UX 设计师、前端工程师、后端工程师、AI/数据工程师、GitHub Copilot / Codex / Cursor / Windsurf 等 AI 编程环境  
> 版本：v1.0  
> 语言：中文为主，可扩展英文版  
> 项目定位：面向气候时代的可信身份、能力认证、行动记录与国际协作基础设施

---

## 1. 文件目的

本文件用于系统性定义 Climate Passport 的产品愿景、核心概念、开发范围、模块结构、用户角色、业务闭环、技术方向、数据结构、界面风格与阶段性开发路径。

它不是单一功能需求文档，而是 Climate Passport 项目的“总说明书”与开发上下文文件，供产品、设计、研发与 AI 编程工具共同参考。

开发过程中，GitHub Copilot / Codex 在生成代码、组件、页面、数据库模型、API、后台管理功能、用户流程时，应始终遵循本说明书中的定义与原则。

---

## 2. Climate Passport 的定义

### 2.1 一句话定义

**Climate Passport 是一个面向气候时代的可信数字身份与行动记录平台，用于记录个人、机构和项目在可持续发展、气候行动、学习认证、国际交流与社会贡献中的可信经历，并将这些经历转化为可验证、可展示、可积累、可用于协作与发展的数字资产。**

### 2.2 产品本质

Climate Passport 不只是一个网站，也不是单纯的证书系统、活动报名系统、学习平台或会员系统。

它本质上是一个：

- **气候时代的数字身份系统**
- **可持续能力与行动记录系统**
- **可信证书与成果验证系统**
- **国际项目与活动参与记录系统**
- **绿色人才与能力地图基础设施**
- **连接个人、机构、企业、政府和国际组织的协作平台**
- **AI 赋能的个人成长、组织选才和区域人才洞察系统**

### 2.3 对外表达

对外可以使用以下表达：

> Climate Passport is a trusted identity infrastructure for the climate era.

中文表达：

> 气候护照是一个面向气候时代的可信身份基础设施。

扩展表达：

> Climate Passport 通过记录学习、证书、活动、项目、行动与合作，帮助个人形成可验证的气候时代能力档案，帮助机构管理与认证项目成果，帮助企业发现绿色人才，帮助政府和城市理解可持续发展人才与行动生态。

---

## 3. 项目愿景

### 3.1 长期愿景

Climate Passport 的长期愿景是成为全球气候时代个人与机构可信记录的基础设施。

它希望回答以下问题：

- 一个人在可持续发展领域真正学习过什么？
- 参与过什么项目？
- 获得过哪些可信认证？
- 做出过哪些气候行动？
- 是否具备进入绿色经济、气候治理、可持续金融、ESG、可持续商业、低碳城市、未来食物、水安全、文化遗产保护等领域的能力？
- 这些记录是否可以被验证？
- 这些记录是否属于个人本人？
- 这些能力是否可以被企业、学校、机构、城市或政府理解和使用？

### 3.2 核心目标

Climate Passport 要实现：

1. **记录可信行动**
   - 学习、培训、活动、项目、志愿服务、调研、演讲、组织、成果、证书等都可以被记录。

2. **建立可信身份**
   - 每个用户拥有自己的 Climate Passport ID。
   - 每个记录可以被机构签发、审核或验证。

3. **形成数字资产**
   - 用户的学习成果、证书、行动记录、项目经历和能力标签应成为个人长期拥有的数字资产。

4. **支持国际交流**
   - 支持中英文和未来多语言。
   - 适用于国际会议、青年项目、联合国相关项目、气候周、城市合作、学校项目、企业项目。

5. **连接教育、活动与职业发展**
   - 将学习、实践、项目、认证、招聘、组织合作连接为闭环。

6. **服务 C / B / G 多端**
   - C 端：个人成长与可信档案。
   - B 端：企业、学校、机构选才、认证、活动管理、项目管理。
   - G 端：区域人才地图、能力热力图、政策与产业洞察。

---

## 4. 产品价值主张

### 4.1 对个人用户

Climate Passport 帮助个人：

- 建立气候时代的数字身份；
- 记录学习经历、活动参与、项目成果和证书；
- 形成可展示、可验证的个人可持续发展履历；
- 获得徽章、积分、等级、证书和行动记录；
- 发现适合自己的学习项目、活动、挑战和国际机会；
- 通过 AI 获得成长路径建议；
- 未来用于升学、实习、求职、项目申请、国际交流。

### 4.2 对教育机构 / 项目机构

Climate Passport 帮助机构：

- 发布学习项目、活动、挑战、夏校、游学、访问、对话等；
- 管理报名、审核、参与、签到、完成状态；
- 签发证书、徽章、积分和项目记录；
- 建立机构自己的项目成果与参与者数据库；
- 提升项目的可信度与国际化表达；
- 通过数据了解项目影响力。

### 4.3 对企业

Climate Passport 帮助企业：

- 识别具备可持续发展能力的人才；
- 发布绿色岗位、项目合作或挑战；
- 使用用户的可信记录进行候选人筛选；
- 理解人才在 ESG、可持续金融、低碳技术、绿色供应链、气候治理等领域的能力标签；
- 未来接入 AI 专家智能体，为企业提供政策、行业、区域和人才洞察。

### 4.4 对政府 / 城市 / 园区

Climate Passport 帮助政府与城市：

- 构建绿色人才地图；
- 了解区域可持续发展人才结构；
- 分析产业、学校、机构、企业中的能力分布；
- 支持政策制定、项目设计、城市品牌和国际交流；
- 衡量青年行动、教育项目和气候项目影响力。

### 4.5 对国际组织和合作伙伴

Climate Passport 帮助国际组织：

- 更容易识别青年参与者、项目成果和行动记录；
- 管理国际项目参与路径；
- 支持多国、多城市、多机构协作；
- 建立可验证的项目参与与成果记录。

---

## 5. 产品边界

### 5.1 Climate Passport 是什么

Climate Passport 是：

- 数字身份平台；
- 可持续发展能力档案；
- 证书与徽章系统；
- 活动与项目参与记录系统；
- 学习经历与成果记录系统；
- 可信验证系统；
- AI 赋能的个人与组织服务平台；
- 面向气候时代的人才基础设施。

### 5.2 Climate Passport 不是什么

Climate Passport 不是：

- 单纯的 LMS 学习平台；
- 单纯的活动报名系统；
- 单纯的证书制作工具；
- 单纯的社交网络；
- 单纯的招聘网站；
- 单纯的 Web3 钱包；
- 单纯的碳账户；
- 单纯的公益环保网站；
- 单纯的青年活动网站。

它可以连接这些系统，但不能被这些系统中的某一个功能定义。

---

## 6. 目标用户与角色

### 6.1 C 端个人用户

包括：

- 高中生；
- 大学生；
- 青年行动者；
- 可持续发展学习者；
- ESG / 气候 / 可持续金融从业者；
- 国际项目参与者；
- 志愿者；
- 研究者；
- 项目组织者；
- 未来绿色经济人才。

主要需求：

- 注册 Climate Passport；
- 完善个人资料；
- 参加活动和项目；
- 获得证书、徽章、积分；
- 展示个人记录；
- 分享验证链接或二维码；
- 获得 AI 成长建议。

### 6.2 B 端机构用户

包括：

- 学校；
- 教育机构；
- 企业；
- NGO；
- 研究机构；
- 国际组织合作项目；
- 活动主办方；
- 培训机构；
- 城市项目办公室；
- 气候周、论坛、峰会等组织方。

主要需求：

- 创建机构主页；
- 发布活动、项目、课程；
- 审核报名；
- 管理签到；
- 签发证书和徽章；
- 查看参与者数据；
- 管理机构成员；
- 查看项目影响力。

### 6.3 G 端政府 / 城市 / 园区用户

包括：

- 政府部门；
- 城市可持续发展项目；
- 园区管理方；
- 人才服务机构；
- 产业促进机构；
- 政策研究机构。

主要需求：

- 查看人才热力图；
- 查看区域能力分布；
- 分析项目影响；
- 支持政策制定；
- 支持城市国际传播；
- 支持青年行动计划和绿色产业人才建设。

### 6.4 管理员

包括：

- 平台超级管理员；
- 机构管理员；
- 项目管理员；
- 活动管理员；
- 证书管理员；
- 审核人员；
- 内容管理员。

主要需求：

- 用户管理；
- 角色权限管理；
- 机构管理；
- 活动管理；
- 项目管理；
- 证书模板管理；
- 证书签发；
- 数据审核；
- 内容发布；
- 系统配置。

---

## 7. 核心业务闭环

Climate Passport 的核心闭环是：

```txt
注册身份
  ↓
参加学习 / 活动 / 项目 / 行动
  ↓
获得记录 / 积分 / 徽章 / 证书
  ↓
形成可信气候护照
  ↓
用于展示 / 验证 / 申请 / 招聘 / 合作
  ↓
产生更多学习、行动、项目和机会
```

扩展闭环：

```txt
机构发布项目
  ↓
用户报名参与
  ↓
活动签到 / 学习完成 / 项目提交
  ↓
机构审核
  ↓
系统签发证书 / 徽章 / 积分
  ↓
记录进入用户 Climate Passport
  ↓
数据进入机构与区域人才图谱
```

---

## 8. 核心模块总览

Climate Passport 应至少包含以下核心模块：

1. 用户身份模块
2. Climate Passport 档案模块
3. 证书模块
4. 徽章与积分模块
5. 活动模块
6. 学习项目模块
7. 报名与申请模块
8. 签到与验证模块
9. 机构模块
10. 项目与行动记录模块
11. AI 成长建议模块
12. 人才地图与数据洞察模块
13. 内容与资讯模块
14. 后台管理模块
15. 权限与审计模块
16. 多语言与国际化模块
17. 通知模块
18. API 与集成模块

---

## 9. 用户身份模块

### 9.1 功能目标

建立每个用户的唯一 Climate Passport 身份。

### 9.2 基础功能

- 用户注册；
- 登录；
- 邮箱验证；
- 手机号绑定，可选；
- 第三方登录，可选；
- 密码重置；
- 用户资料编辑；
- 头像上传；
- 国家 / 地区；
- 所属学校 / 机构 / 企业；
- 个人简介；
- 语言偏好；
- 隐私设置。

### 9.3 Climate Passport ID

每个用户应拥有唯一 ID，例如：

```txt
CP-2035-000184
```

ID 应具有：

- 唯一性；
- 可查询性；
- 可展示性；
- 可用于证书验证；
- 可用于二维码；
- 可用于未来链上或可信存证。

### 9.4 用户身份状态

建议状态：

- Unverified 未验证
- Email Verified 邮箱已验证
- Profile Completed 资料已完善
- Institution Linked 已关联机构
- Advanced Verified 高级验证
- Suspended 暂停

---

## 10. Climate Passport 档案模块

### 10.1 模块定义

Climate Passport 档案是用户的核心展示页面，相当于个人在气候时代的可信数字护照。

### 10.2 应包含内容

- 用户基本信息；
- Climate Passport ID；
- 身份验证状态；
- 证书数量；
- 活动参与数量；
- 学习记录数量；
- 项目参与数量；
- 行动记录；
- 徽章；
- 积分；
- 能力标签；
- 机构关联；
- 公开分享链接；
- 二维码；
- AI 建议。

### 10.3 展示结构

建议页面结构：

1. 用户身份卡
2. Climate Passport ID 卡
3. Verified Records 概览
4. Credentials Timeline
5. Activities / Events
6. Learning Records
7. Projects / Actions
8. Badges / Points
9. AI Insight
10. Share / Verify

### 10.4 可见性设置

用户应可以控制部分信息是否公开：

- 完全公开；
- 仅机构可见；
- 仅通过链接可见；
- 私密；
- 仅显示摘要。

---

## 11. 证书模块

### 11.1 模块定义

证书模块是 Climate Passport 的核心可信能力模块，用于模板配置、证书签发、证书验证、证书展示与证书归档。

### 11.2 证书来源

证书可以来自：

- 课程完成；
- 活动参与；
- 项目完成；
- 主持 / 演讲 / 志愿服务；
- 竞赛 / 挑战；
- 国际项目；
- 机构认证；
- 管理员手工签发；
- 自动触发签发。

### 11.3 证书模板功能

证书模板应支持：

- 模板名称；
- 模板类型；
- 封面 / 内页 / 封底，可选；
- 证书底图上传；
- 动态字段；
- 签名；
- 盖章；
- 证书编号；
- 二维码；
- 签发机构；
- 签发日期；
- 有效期；
- 中英文内容；
- HTML / JSON 模板配置；
- PDF 导出；
- 公开验证页。

### 11.4 证书状态

建议状态：

- Draft 草稿
- Pending Review 待审核
- Issued 已签发
- Verified 已验证
- Revoked 已撤销
- Expired 已过期
- Reissued 已重新签发

### 11.5 证书验证

每张证书应有：

- Credential ID；
- Verification URL；
- QR Code；
- 签发机构；
- 签发时间；
- 接收人；
- 证书状态；
- 防篡改记录；
- 可选链上存证信息。

---

## 12. 徽章与积分模块

### 12.1 模块定义

徽章与积分用于记录用户在 Climate Passport 中的持续参与、成长与贡献。

### 12.2 积分来源

积分可来自：

- 完成课程；
- 参加活动；
- 签到；
- 完成项目；
- 提交成果；
- 获得证书；
- 组织活动；
- 发表内容；
- 推荐他人；
- 完成挑战；
- 被机构认证。

### 12.3 徽章类型

建议徽章类型：

- Learning Badge 学习徽章；
- Event Badge 活动徽章；
- Action Badge 行动徽章；
- Leadership Badge 领导力徽章；
- Collaboration Badge 协作徽章；
- Verified Credential Badge 认证徽章；
- Partner Badge 合作伙伴徽章；
- City Badge 城市徽章；
- Special Recognition Badge 特别认可徽章。

### 12.4 等级体系

可设计等级：

- Explorer
- Contributor
- Builder
- Leader
- Ambassador
- Fellow

中文可对应：

- 探索者
- 贡献者
- 建设者
- 领导者
- 青年大使
- 伙伴代表

---

## 13. 活动模块

### 13.1 模块定义

活动模块用于支持会议、论坛、培训、对话、夏校、游学、挑战、访问、研学等项目的发布、报名、签到、参与记录和证书签发。

### 13.2 活动类型

包括但不限于：

- Conference 会议
- Forum 论坛
- Workshop 工作坊
- Training 培训
- Dialogue 对话
- Summer School 夏校
- Study Tour 游学
- Challenge 挑战
- Visit 访问
- Youth Assembly 青年大会
- Side Event 边会
- Field Trip 实地调研
- Online Course 在线课程

### 13.3 活动基础字段

- 活动名称；
- 活动副标题；
- 活动类型；
- 活动简介；
- 活动详情；
- 主办方；
- 合作方；
- 地点；
- 开始时间；
- 结束时间；
- 报名开始时间；
- 报名截止时间；
- 语言；
- 是否收费；
- 是否需要审核；
- 容量；
- 海报图；
- 详情页模板；
- 报名表模板；
- 证书模板；
- 积分规则；
- 徽章规则。

### 13.4 活动流程

```txt
活动创建
  ↓
发布
  ↓
用户报名
  ↓
管理员审核
  ↓
用户获得入场 / 参与资格
  ↓
现场二维码签到
  ↓
完成参与
  ↓
签发记录 / 积分 / 徽章 / 证书
```

---

## 14. 学习项目模块

### 14.1 模块定义

学习项目模块用于承载官方认证学习项目、FSA Credential 培训、IFRS 可持续准则课程、青年项目、夏校、研学、挑战等。

### 14.2 项目分类

建议分类：

- 官方认证学习项目；
- 专业证书培训；
- 青年行动项目；
- 国际交流项目；
- 夏校 / 游学；
- 企业实践项目；
- 城市挑战项目；
- 可持续金融项目；
- 气候治理项目；
- 未来食物项目；
- 水安全项目；
- 文化遗产与气候项目。

### 14.3 项目功能

- 项目首页；
- 项目详情；
- 报名申请；
- 审核；
- 付款状态，可选；
- 学习进度；
- 参与记录；
- 任务提交；
- 成果上传；
- 证书签发；
- 徽章和积分；
- 进入 Climate Passport 档案。

### 14.4 与 LMS 的关系

Climate Passport 可以连接 Tutor LMS 或其他学习系统，但不一定替代 LMS。

建议边界：

- LMS 负责课程内容、学习进度、测验；
- Climate Passport 负责身份、认证、证书、记录、积分、项目归档和展示；
- 完成课程后，LMS 向 Climate Passport 发出完成事件；
- Climate Passport 签发证书、徽章、积分和记录。

---

## 15. 报名与申请模块

### 15.1 功能目标

支持用户申请参加项目、活动、课程、挑战、国际交流等。

### 15.2 报名表配置

应支持：

- 文本字段；
- 单选；
- 多选；
- 下拉；
- 文件上传；
- 个人陈述；
- 推荐人信息；
- 学校 / 机构信息；
- 护照 / 身份信息，可选；
- 家长信息，可选；
- 费用条款确认；
- 隐私授权；
- 多语言表单。

### 15.3 审核流程

状态建议：

- Draft 草稿
- Submitted 已提交
- Under Review 审核中
- Need More Info 需补充材料
- Accepted 已录取
- Waitlisted 候补
- Rejected 未通过
- Confirmed 已确认
- Cancelled 已取消

### 15.4 费用逻辑

对于收费项目，报名阶段可以不收款。

推荐表达：

> 提交报名申请不代表产生付款义务。仅在申请通过、申请人确认接受项目名额及费用条款后，才需按照通知完成付款。

系统状态：

- No Fee 无费用；
- Fee Required 需费用；
- Pending Payment 待支付；
- Paid 已支付；
- Waived 已减免；
- Refunded 已退款。

---

## 16. 签到与验证模块

### 16.1 功能目标

通过二维码将线下活动与 Climate Passport 记录连接。

### 16.2 签到流程

```txt
用户报名并审核通过
  ↓
系统生成报名记录
  ↓
现场扫码签到
  ↓
系统验证是否存在有效报名
  ↓
显示通过 / 无注册信息 / 状态异常
  ↓
写入参与记录
  ↓
触发积分、徽章或证书
```

### 16.3 签到结果

- Checked In 已签到；
- Not Registered 无注册信息；
- Not Approved 未审核通过；
- Already Checked In 已签到；
- Invalid QR 无效二维码；
- Event Closed 活动已结束。

### 16.4 现场管理

管理员应支持：

- 扫码签到；
- 手工签到；
- 查看签到列表；
- 导出签到数据；
- 现场补录；
- 签到后触发证书或积分。

---

## 17. 机构模块

### 17.1 模块定义

机构模块用于支持学校、企业、国际组织、研究机构、活动主办方、项目合作方等在 Climate Passport 中建立组织身份。

### 17.2 机构类型

- School 学校；
- University 大学；
- Company 企业；
- NGO 非营利组织；
- International Organization 国际组织；
- Government 政府机构；
- City 城市；
- Research Institute 研究机构；
- Training Provider 培训机构；
- Event Organizer 活动组织方；
- Partner 合作伙伴。

### 17.3 机构功能

- 机构主页；
- 机构认证；
- 成员管理；
- 项目管理；
- 活动管理；
- 证书签发；
- 数据看板；
- 机构徽章；
- 合作项目展示；
- API 对接。

### 17.4 机构认证状态

- Unverified 未认证；
- Submitted 已提交；
- Under Review 审核中；
- Verified 已认证；
- Suspended 暂停；
- Revoked 撤销。

---

## 18. 项目与行动记录模块

### 18.1 模块定义

行动记录是 Climate Passport 的核心资产之一。它记录用户实际参与和完成的行动，而不只是学习和证书。

### 18.2 行动类型

- 志愿服务；
- 组织活动；
- 发表演讲；
- 完成调研；
- 提交方案；
- 参与挑战；
- 发起项目；
- 城市行动；
- 企业实践；
- 学术研究；
- 社区行动；
- 国际交流；
- 文化遗产保护；
- 未来食物项目；
- 水安全项目；
- 可持续金融项目。

### 18.3 行动记录字段

- 标题；
- 类型；
- 描述；
- 时间；
- 地点；
- 所属项目；
- 组织方；
- 证明材料；
- 审核状态；
- 贡献角色；
- 成果链接；
- 图片 / 文件；
- 关联证书；
- 关联徽章；
- 关联积分。

---

## 19. AI 模块

### 19.1 AI 对个人

AI 可以帮助用户：

- 分析个人 Climate Passport；
- 识别能力优势；
- 发现能力缺口；
- 推荐学习路径；
- 推荐项目与活动；
- 生成个人可持续发展履历；
- 生成申请材料；
- 生成英文简介；
- 生成能力地图；
- 匹配岗位或机会。

### 19.2 AI 对机构

AI 可以帮助机构：

- 生成活动介绍；
- 生成项目详情页；
- 生成证书文案；
- 分析申请人；
- 汇总项目成果；
- 生成影响力报告；
- 推荐参与者；
- 分析项目反馈。

### 19.3 AI 对企业

AI 可以帮助企业：

- 生成绿色岗位描述；
- 筛选候选人；
- 匹配人才标签；
- 分析候选人的可持续发展能力；
- 生成面试建议；
- 提供政策、行业、市场、区域智能体服务。

### 19.4 AI 对政府

AI 可以帮助政府：

- 分析区域人才图谱；
- 生成人才报告；
- 识别产业能力缺口；
- 分析城市青年行动；
- 支持政策研究；
- 支持项目评估。

---

## 20. 数据与人才地图模块

### 20.1 模块定义

人才地图是 Climate Passport 的 B/G 端高级价值模块，用于将个人能力、学习、证书、项目、行动和区域数据进行可视化。

### 20.2 可视化维度

- 地区；
- 城市；
- 学校；
- 企业；
- 行业；
- 能力标签；
- 项目类型；
- 证书类型；
- 活动参与；
- 年龄段；
- 学习路径；
- 可持续发展主题。

### 20.3 数据产品

未来可形成：

- 绿色人才热力图；
- 城市气候人才地图；
- 青年可持续行动指数；
- 机构项目影响力报告；
- 企业绿色人才池；
- 区域能力缺口分析；
- 气候行动参与度报告。

---

## 21. 内容与资讯模块

### 21.1 模块目标

Climate Passport 应有内容能力，用于发布：

- 项目新闻；
- 活动资讯；
- 证书说明；
- 合作伙伴动态；
- 标准与方法论；
- 学习资源；
- 案例；
- 白皮书；
- 报告；
- 青年故事。

### 21.2 内容类型

- News 新闻；
- Update 动态；
- Article 文章；
- Report 报告；
- Case Study 案例；
- Knowledge 知识；
- Announcement 公告；
- Partner Story 合作伙伴故事；
- Programme Call 项目招募；
- Event Recap 活动回顾。

---

## 22. 后台管理模块

### 22.1 管理后台目标

后台应支持平台、机构和项目的日常运营管理。

### 22.2 后台核心功能

- Dashboard；
- 用户管理；
- 机构管理；
- 活动管理；
- 项目管理；
- 报名管理；
- 证书管理；
- 徽章管理；
- 积分管理；
- 内容管理；
- 审核管理；
- 数据报表；
- 权限管理；
- 系统设置；
- 审计日志。

### 22.3 后台设计原则

后台应保持：

- 审计友好；
- 信息清晰；
- 低颜色；
- 强状态；
- 表格高可读；
- 操作可追溯；
- 权限明确。

---

## 23. 权限体系

### 23.1 用户角色

建议初始角色：

- Super Admin；
- Platform Admin；
- Organization Admin；
- Project Admin；
- Event Admin；
- Certificate Manager；
- Reviewer；
- Content Editor；
- Individual User；
- Institution Member；
- Viewer。

### 23.2 权限对象

- 用户；
- 机构；
- 活动；
- 项目；
- 报名；
- 证书；
- 徽章；
- 内容；
- 数据报表；
- 系统配置。

### 23.3 权限规则

建议采用 RBAC + 资源归属。

示例：

- 机构管理员只能管理本机构项目；
- 项目管理员只能管理所属项目；
- 证书管理员只能签发授权模板；
- 超级管理员可管理所有资源；
- 用户只能编辑自己的 Passport；
- 公开验证页不需要登录。

---

## 24. 技术架构建议

### 24.1 推荐技术栈

前端：

- Next.js App Router；
- React；
- TypeScript；
- Tailwind CSS；
- next-intl；
- shadcn/ui 可选；
- Framer Motion 可选。

后端：

- Next.js API Routes / Route Handlers；
- Node.js；
- PostgreSQL；
- Prisma ORM；
- NextAuth；
- Object Storage；
- Redis，可选；
- Queue，可选。

部署：

- Vercel；
- Neon PostgreSQL；
- Cloudflare；
- AWS SES / Google Workspace / Zoho Mail 负责邮件；
- S3 / R2 / OSS 用于文件存储。

### 24.2 推荐目录结构

```txt
src/
  app/
    [locale]/
      page.tsx
      passport/
      verify/
      admin/
      events/
      programmes/
      credentials/
      organizations/

  components/
    cp/
      CPButton.tsx
      CPPill.tsx
      CPCard.tsx
      CPHeader.tsx
      CPFooter.tsx
      CPMetricCard.tsx
      CPInstitutionalVisual.tsx
      CPTable.tsx

  lib/
    auth/
    db/
    i18n/
    permissions/
    verification/
    certificates/
    ai/

  prisma/
    schema.prisma

  styles/
    globals.css
    climate-passport-tokens.css
```

---

## 25. 数据模型建议

### 25.1 核心实体

建议初始数据表：

- User；
- UserProfile；
- ClimatePassport；
- Organization；
- OrganizationMember；
- Event；
- EventRegistration；
- EventCheckIn；
- Programme；
- ProgrammeApplication；
- Credential；
- CredentialTemplate；
- Badge；
- UserBadge；
- PointTransaction；
- ActionRecord；
- Project；
- LearningRecord；
- VerificationLog；
- AuditLog；
- ContentPost；
- Notification。

### 25.2 User

基础字段：

- id；
- email；
- passwordHash；
- name；
- avatar；
- role；
- status；
- locale；
- createdAt；
- updatedAt。

### 25.3 ClimatePassport

字段：

- id；
- userId；
- passportNumber；
- visibility；
- verificationLevel；
- trustScore；
- region；
- headline；
- summary；
- createdAt；
- updatedAt。

### 25.4 Credential

字段：

- id；
- credentialId；
- userId；
- issuerOrganizationId；
- templateId；
- title；
- description；
- status；
- issueDate；
- expiryDate；
- verificationUrl；
- qrCodeUrl；
- metadata；
- revokedAt；
- createdAt；
- updatedAt。

### 25.5 EventRegistration

字段：

- id；
- eventId；
- userId；
- status；
- applicationData；
- paymentStatus；
- reviewedBy；
- reviewedAt；
- createdAt；
- updatedAt。

### 25.6 ActionRecord

字段：

- id；
- userId；
- type；
- title；
- description；
- organizationId；
- projectId；
- eventId；
- evidenceUrl；
- status；
- verifiedBy；
- verifiedAt；
- createdAt；
- updatedAt。

---

## 26. API 设计建议

### 26.1 公共 API

- `GET /api/public/credential/:id`
- `GET /api/public/passport/:id`
- `GET /api/public/events`
- `GET /api/public/programmes`

### 26.2 用户 API

- `GET /api/me`
- `PATCH /api/me/profile`
- `GET /api/me/passport`
- `GET /api/me/credentials`
- `GET /api/me/badges`
- `GET /api/me/points`
- `GET /api/me/actions`

### 26.3 活动 API

- `GET /api/events`
- `POST /api/events`
- `GET /api/events/:id`
- `PATCH /api/events/:id`
- `POST /api/events/:id/register`
- `POST /api/events/:id/check-in`

### 26.4 证书 API

- `GET /api/credentials`
- `POST /api/credentials/issue`
- `GET /api/credentials/:id`
- `POST /api/credentials/:id/revoke`
- `GET /api/credentials/:id/verify`

### 26.5 AI API

- `POST /api/ai/passport-insight`
- `POST /api/ai/programme-recommendation`
- `POST /api/ai/profile-summary`
- `POST /api/ai/institution-report`

---

## 27. 系统事件机制

Climate Passport 应采用事件驱动思想。

### 27.1 典型事件

- USER_REGISTERED；
- PROFILE_COMPLETED；
- EVENT_REGISTERED；
- EVENT_APPROVED；
- EVENT_CHECKED_IN；
- PROGRAMME_COMPLETED；
- CREDENTIAL_ISSUED；
- BADGE_GRANTED；
- POINTS_ADDED；
- ACTION_SUBMITTED；
- ACTION_VERIFIED；
- ORGANIZATION_VERIFIED。

### 27.2 事件用途

事件可触发：

- 积分；
- 徽章；
- 证书；
- 通知；
- 审计日志；
- AI 分析；
- 数据统计。

---

## 28. 通知模块

### 28.1 通知渠道

- 邮件；
- 站内通知；
- 短信，可选；
- 微信 / 飞书 / Telegram，可选；
- 浏览器推送，可选。

### 28.2 通知场景

- 注册验证；
- 报名成功；
- 审核通过；
- 审核失败；
- 需补充材料；
- 活动提醒；
- 签到成功；
- 证书签发；
- 徽章获得；
- 积分变动；
- 系统公告。

---

## 29. 国际化与语言

### 29.1 语言

第一阶段支持：

- 中文；
- 英文。

未来支持：

- 日文；
- 韩文；
- 法文；
- 西班牙文；
- 阿拉伯文。

### 29.2 多语言原则

- 所有页面文本进入字典；
- 不在组件中硬编码长文本；
- URL 支持 locale；
- 日期、时间、数字格式本地化；
- 证书模板支持多语言；
- 活动详情支持多语言；
- 邮件模板支持多语言。

---

## 30. 视觉与 UI 规范

Climate Passport 的 UI 应参考已形成的设计基座：

- WEF 式国际平台；
- 深绿蓝主色；
- 绿色金融 / 气候基础设施气质；
- 大留白；
- 低饱和；
- 轻边框；
- 轻阴影；
- 克制动效；
- 中英文适配；
- 顶级机构感。

### 30.1 主色

```css
--cp-ink: #12382F;
--cp-ink-hover: #17483D;
--cp-forest: #1F5A4E;
--cp-bg: #F6F9F6;
--cp-bg-soft: #EEF6F1;
--cp-line: #DDE7E1;
--cp-line-strong: #BFD0C8;
--cp-text-secondary: #36524B;
```

### 30.2 UI 禁止项

不得使用：

- 鲜艳绿色按钮；
- 卡通地球；
- 叶子图标作为核心品牌；
- 彩色大渐变；
- NGO 公益风；
- 过度 Web3 风；
- 过重阴影；
- 密集后台；
- 过大字体；
- 花哨动画。

---

## 31. 安全与隐私

### 31.1 安全原则

- 用户数据加密存储；
- 密码使用强哈希；
- 重要操作记录审计日志；
- 管理员操作可追踪；
- 权限最小化；
- 证书撤销可追溯；
- 防止伪造证书；
- 防止越权访问。

### 31.2 隐私原则

- 用户拥有自己的 Climate Passport 记录；
- 用户可控制公开范围；
- 机构只能访问授权数据；
- 对外验证页只展示必要信息；
- 数据使用需明确授权；
- 面向未成年人项目需考虑监护人同意。

---

## 32. MVP 阶段建议

### 32.1 MVP 目标

在 3–6 个月内推出可用版本，用于支持真实活动、项目报名、证书签发和 Climate Passport 基础档案。

### 32.2 MVP 必须包含

1. 用户注册 / 登录；
2. 用户 Profile；
3. Climate Passport ID；
4. 活动发布；
5. 报名申请；
6. 管理员审核；
7. 二维码签到；
8. 基础证书模板；
9. 手工 / 自动证书签发；
10. 证书验证页；
11. 用户 Passport 页面；
12. 后台管理；
13. 中英文；
14. 邮件通知；
15. 基础积分和徽章。

### 32.3 MVP 可暂缓

- 区块链；
- 复杂 AI；
- 招聘市场；
- 政府人才地图；
- 复杂积分商城；
- 多机构复杂权限；
- App 原生版本；
- 大规模社交功能。

---

## 33. 第二阶段建议

第二阶段增加：

- AI Passport Insight；
- 项目推荐；
- 机构看板；
- 数据报表；
- 人才标签；
- 徽章体系完善；
- 积分体系；
- 内容模块；
- 更多证书模板；
- Tutor LMS / 其他学习平台对接；
- 多机构项目协作；
- 批量证书签发。

---

## 34. 第三阶段建议

第三阶段增加：

- 企业端人才搜索；
- 政府端人才地图；
- AI 专家智能体；
- 国际项目网络；
- 区块链存证；
- 开放 API；
- 数据服务；
- 积分兑换；
- 移动端 App；
- 全球多语言扩展。

---

## 35. 给 Copilot / Codex 的总开发指令

可将以下内容直接复制给 AI 编程工具：

```txt
你正在开发 Climate Passport。

Climate Passport 是一个面向气候时代的可信数字身份、证书、行动记录、学习项目和国际协作基础设施。它不是普通环保网站，也不是单纯 LMS、活动报名系统或证书工具。

请始终围绕以下核心对象开发：User、ClimatePassport、Credential、Badge、PointTransaction、Event、EventRegistration、EventCheckIn、Programme、ProgrammeApplication、Organization、ActionRecord、LearningRecord、VerificationLog、AuditLog。

产品需要支持 C/B/G 多端：
C 端是个人气候身份与成长档案；
B 端是机构发布项目、管理活动、签发证书和查看数据；
G 端未来是人才地图、城市能力分析和政策支持。

UI 风格必须遵循 WEF 式国际机构风格，使用深绿蓝 #12382F、森林绿 #1F5A4E、浅绿灰 #F6F9F6、边框 #DDE7E1、辅助文字 #36524B。保持大留白、低饱和、轻边框、轻阴影、克制动效和多语言友好。禁止使用鲜艳绿色、卡通地球、叶子、NGO公益风、过度Web3视觉和花哨动画。

优先开发 MVP：用户注册登录、Climate Passport ID、个人档案、活动发布、报名审核、二维码签到、证书模板、证书签发、证书验证、用户 Passport 页面、后台管理、中英文、邮件通知、基础积分和徽章。

所有核心操作需要可审计、可追踪、可验证。证书、行动记录、项目参与记录和徽章都应进入用户 Climate Passport，并可在权限允许的范围内展示和验证。
```

---

## 36. 最终总结

Climate Passport 应被开发为：

> 一个面向气候时代的可信身份基础设施，将学习、证书、活动、项目、行动、能力和国际协作转化为可验证、可积累、可展示、可使用的数字资产。

它的长期价值不在于单个活动、单张证书或单个课程，而在于建立一个可信的全球气候行动与能力记录网络。

最终，它应服务于：

- 个人成长；
- 教育创新；
- 青年行动；
- 企业绿色人才；
- 城市与政府人才治理；
- 国际组织合作；
- 全球气候行动基础设施建设。

