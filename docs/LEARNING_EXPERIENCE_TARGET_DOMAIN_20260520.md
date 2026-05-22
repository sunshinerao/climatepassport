# Learning Experience Target Domain 2026-05-20

## 需求解读

- 用户要求继续推进“1 和 2”时，除了 runnable system，还要求重新判断 Learning Experiences 是否可以并入 Event。
- 当前结论需要服务于 Climate Passport 主平台架构，而不是为了前台展示方便而把 LE 压扁成普通 Event。

## 修改方法

- 以 bounded context 的方式重新切分 LE 与 Event、Passport、Organization、Certificate 的边界。
- 用“系统归属”“流程形态”“数据沉淀”“可复用性”四个维度判断 LE 是否应该折叠进 Event。
- 保持与当前 Passport 产品化路径兼容，避免未来再次从 Event 中拆域造成二次迁移成本。

## 修改内容

- 结论：Learning Experiences 不应直接折叠为 Event。它应当是独立的 Program/Application 子域，必要时再与一个或多个 Event 建立关联。
- 建议的目标域结构：
  - `LearningExperienceCategory`: 项目类别，例如 summer school、fellowship、lab、bootcamp
  - `LearningExperienceProgram`: 项目本体，承载招生周期、申请模板、渠道覆盖、合作机构、证书/成果规则
  - `LearningExperienceApplication`: 用户申请记录，独立于 Event registration
  - `LearningExperienceStage`: 审核、面试、录取、待确认、在读、结项等阶段流转
  - `LearningExperienceParticipation`: 用户在项目中的真实参与、完成度、成果沉淀
  - `ProgramEventLink`: 将 program 与 orientation、demo day、graduation ceremony 等 Event 建立从属关系
- 与 Event 的边界：
  - Event 负责公开排期、议程、报名、签到、现场参与
  - Learning Experience 负责招生、筛选、项目过程、阶段评审、长期成长结果
- 与 Passport 的边界：
  - Passport 负责身份、成就、积分、证书、长期档案
  - Learning Experience 产出的 completion、mentor review、milestone 可写入 Passport，但 Passport 不是 LE 的流程引擎
- 与 SHCW shell 的边界：
  - SHCW 只负责主题化承载和品牌壳页
  - LE 的主数据与申请流程应归属 Climate Passport
- 推荐下一步：
  - 在 Prisma 中补 `LearningExperienceProgram` / `Application` / `ProgramEventLink`
  - 复用现有 Event 页面作为 program 关联 event 的展示层，而不是反向把 application 流塞进 Event registration
