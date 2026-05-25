# 需求解读
证书后台页面中的主操作按钮和活跃标签在实际页面上仍然呈现白底，需要保证这些按钮在所有渲染路径下都能稳定显示为高对比度的强调色，避免和页面背景混在一起。

# 修改方法
先保留组件内的内联样式兜底，再把证书后台按钮主题样式从依赖祖先类的写法收紧为直接命中按钮类本身，并对关键颜色属性使用更高优先级覆盖，减少被基础按钮样式或其他重置规则压回白底的风险。

# 修改内容
- 调整 `apps/passport-web/app/styles/features/certificate-admin.css` 中的按钮主题规则。
- 将 `cpca-btn-amber`、`cpca-btn-outline`、`cpca-btn-ghost`、`cpca-btn-success`、`cpca-btn-danger` 改为直接命中按钮类。
- 对关键的 `background`、`color`、`border-color` 使用更强的覆盖，确保活跃按钮不会回落成白色默认样式。
- 保留组件里针对三个活跃标签按钮的内联颜色兜底。
