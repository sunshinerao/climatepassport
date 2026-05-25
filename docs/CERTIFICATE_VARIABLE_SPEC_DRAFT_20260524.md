# 证书变量规范草案

## 1. 目的

这份草案用于统一证书模板里的可用变量命名、适用边界和扩展方式，避免模板字段越做越碎，后续难维护、难复用。

当前建议沿用“少量核心变量 + 少量场景扩展变量”的方式，不按每种业务场景无限拆分字段。

## 2. 设计原则

- 变量名应稳定、可跨模板复用。
- 变量应优先描述业务语义，而不是页面文案。
- 同一语义可在不同分类里用不同显示名，但底层变量尽量保持一致。
- 新变量优先加入通用扩展层，避免直接做成单场景专属字段。
- 模板 JSON 里出现的变量，应能被后端稳定识别、清洗和渲染。
- 对于人名、机构名、标题类、场景名这类“天然可能中英不完全对译”的字段，优先预留中英独立字段，而不是只靠运行时翻译。

## 3. 变量分层

### 3.1 建议预留中英独立字段的变量

以下字段建议成对预留 `xxxName` / `xxxNameEn`，因为它们在中文和英文中经常不是逐字直译，而是需要按证书语境单独命名：

- `holderName` / `holderNameEn`：持有人姓名。
- `certificateName` / `certificateNameEn`：证书名称。
- `categoryName` / `categoryNameEn`：证书分类名称。
- `workName` / `workNameEn`：作品名称。
- `eventName` / `eventNameEn`：活动名称。
- `projectName` / `projectNameEn`：项目名称。
- `programName` / `programNameEn`：项目/计划名称。
- `courseName` / `courseNameEn`：课程名称。
- `roleName` / `roleNameEn`：角色名称。
- `organizationName` / `organizationNameEn`：组织名称。
- `institutionName` / `institutionNameEn`：机构名称。
- `achievementName` / `achievementNameEn`：成就名称。
- `milestoneName` / `milestoneNameEn`：里程碑名称。
- `sessionName` / `sessionNameEn`：场次/环节名称。
- `topicName` / `topicNameEn`：主题名称。
- `trackName` / `trackNameEn`：赛道名称。
- `speakerName` / `speakerNameEn`：讲者姓名。
- `mentorName` / `mentorNameEn`：导师姓名。
- `cohortName` / `cohortNameEn`：批次名称。
- `locationName` / `locationNameEn`：地点名称。

建议只在这些“确实可能中英语义分裂”的字段上做独立双语字段，避免所有变量都强行做双份。

### 3.2 需要保留的产品规范固定变量

以下字段应保留，并视为模板基础能力的一部分：

- `issueDate`：签发日期。
- `completionDate`：完成日期。
- `certificateNumber`：证书编号。
- `issuerName`：签发机构名称。
- `signer`：签名人。
- `learningHours`：学习时长。
- `capabilityTags`：能力标签。
- `verificationUrl`：公开验证链接。

### 3.3 场景语义族变量

以下字段建议视为同一类“场景语义”，在不同模板里通过显示名切换，而不是拆成完全独立的建模体系：

- `workName` 族：作品/项目成果/创作名称。
- `eventName` 族：活动/会议/现场/仪式名称。
- `courseName` 族：课程/训练营/学习单元名称。
- `programName` 族：计划/项目/方案名称。
- `roleName` 族：角色/身份/职务名称。
- `organizationName` 族：机构/组织/单位名称。
- `achievementName` 族：成就/成果/荣誉名称。
- `milestoneName` 族：里程碑/阶段成果名称。

### 3.4 仍可后续评估的变量

下面这些字段有用，但不建议一口气全部放进第一版模板变量体系：

- `summaryText`：摘要/说明。
- `description`：长描述。
- `subtitleText`：副标题。
- `footnoteText`：脚注说明。
- `supportText`：补充说明。

## 4. 命名规则

- 变量名使用 `camelCase`。
- 变量名尽量短，但必须语义明确。
- 同一类概念避免使用多个近义词并存，例如不要同时保留 `eventName` 和 `activityName` 作为同级核心变量，除非有非常明确的业务差异。
- 如果某个字段主要服务一个页面文案，优先把它作为“显示名”处理，不要新增底层变量。
- 双语字段建议用同名后缀方式成对出现，例如 `eventName` / `eventNameEn`。
- 对于可枚举标签类内容，优先保存稳定代码，再由中英文标签表展示文案，不建议直接把标签文案当作主数据字段。

## 5. 显示与复用建议

建议采用“底层变量统一，前端显示名可配置”的方式：

- 在活动模板中，`eventName` 可以显示为“活动名称”。
- 在作品模板中，`workName` 可以显示为“作品名称”。
- 在课程模板中，`courseName` 可以显示为“课程名称”。
- 在机构模板中，`organizationName` 可以显示为“机构名称”。

这样可以减少模板字段数量，同时保留业务表达的灵活性。

## 6. 推荐优先级

如果现在要逐步补齐变量，我建议优先级如下：

1. `workName`
2. `eventName`
3. `projectName`
4. `courseName`
5. `roleName`
6. `organizationName`
7. `achievementName`

原因是这些字段最容易覆盖当前证书场景里的高频模板，而不会造成命名冲突。

## 7. 模板配置建议

模板 JSON 里建议只关心“变量名”和“布局表现”，例如：

- 变量名负责取值。
- `label` 负责在模板中显示提示文案。
- `content` 负责纯文本展示。
- `textAlign`、`fontSize`、`lineHeight` 等负责表现。

示例：

```json
{
  "id": "work-name",
  "kind": "VARIABLE",
  "variable": "workName",
  "label": "作品名称",
  "x": 12,
  "y": 28,
  "width": 68,
  "height": 8,
  "fontSize": 24,
  "fontWeight": "600",
  "textAlign": "center"
}
```

## 8. 建议的下一步

- 先确认是否要把 `workName`、`eventName`、`projectName` 作为第一批扩展变量。
- 再确认这些变量是否需要出现在模板帮助文案、签发表单和预览接口里。
- 如果后续证书类型继续增多，可以再考虑是否需要“别名层”而不是增加更多底层变量。
