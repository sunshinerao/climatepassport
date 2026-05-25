# Certificate Variable Issuance Mapping Bugfix (2026-05-24)

## 需求解读
- 当前证书模板变量体系已经扩展，但真实签发与重生成流程里，新增变量未被自动映射到渲染输入，导致仅预览可见、实际产物不可用。
- 需要在不破坏现有签发结果和回退兼容性的前提下，把可获得的业务上下文（定义、类别、签发人、学习项目来源）注入到 `variableValues`。
- 要覆盖两条生产路径：手动签发与证书重生成。

## 修改方法
- 在服务层新增统一变量组装函数，集中处理：
  - 中英文字段回退逻辑。
  - 日期标准化（`YYYY-MM-DD`）。
  - 学习时长和能力标签的容错提取。
- 在签发路由和重生成路由调用该组装函数，构造 `variableValues` 并传入证书产物构建器。
- 修复产物构建器遗漏：将 `variableValues` 继续透传到 `renderCertificateHtml`。
- 增加回归测试，确保 `buildCertificateArtifact` 与 `buildCertificateArtifactWithQr` 对变量透传生效。

## 修改内容
1. 新增文件：`apps/passport-web/lib/server/certificate-variables.ts`
- 新增 `buildIssuedCertificateVariableValues`：统一生成证书变量对象。
- 新增 `extractLearningHoursFromProgramConfig`：从 program config 的多种候选字段提取学时。
- 新增 `extractCapabilityTags`：从多个 JSON 来源合并能力标签数组。

2. 修改：`apps/passport-web/lib/server/certificate-module.ts`
- `buildCertificateArtifact` 新增 `variableValues` 参数并透传给 `renderCertificateHtml`。
- `buildCertificateArtifactWithQr` 新增 `variableValues` 参数并透传给 `renderCertificateHtml`。

3. 修改：`apps/passport-web/app/api/admin/certificates/issue/route.ts`
- 解析模板渲染配置中的签发机构信息。
- 组装手动签发场景变量（包含中英文证书名/类别名、签发人、验证链接等）。
- 调用构建器时传入 `variableValues`。

4. 修改：`apps/passport-web/app/api/admin/certificates/[id]/regenerate/route.ts`
- 针对 `LEARNING_EXPERIENCE` 来源补查 participation/program/event 上下文。
- 自动映射 program/course/project/event/location/completionDate/learningHours/capabilityTags 等变量。
- 调用构建器时传入 `variableValues`。

5. 修改测试：`tests/certificate-artifact.test.mjs`
- 新增回归用例，验证两类产物构建器都能把 `variableValues` 写入配置化变量元素渲染结果。
