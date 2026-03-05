# blog_vue Frontend

基于 `Vue 3 + TypeScript + Pinia + Vue Router + Ant Design Vue` 的博客前端工程，包含门户站点与后台管理。

![alt text](image.png)

![alt text](image-1.png)

## 项目目标

- 门户：首页、文章列表、文章详情、合集、搜索。
- 后台：文章/分类/评论/合集/媒体库/日志/个人设置管理。
- 工程：类型安全、路由分层、服务层封装、主题化样式、构建优化。

## 当前技术栈

- `vue@3.5.x`
- `typescript@5.9.x`（`strict: true`）
- `vite@7.x`
- `vue-router@4.x`
- `pinia@3.x`
- `ant-design-vue@4.x`（按需加载）
- `axios`、`markdown-it`、`katex`
- `eslint + oxlint + prettier + vue-tsc`
- `vitest + playwright`

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.development`（可参考 `.env.example`）：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8001/api/v1
```

### 3. 启动开发

```bash
npm run dev
```

默认端口：`5174`

## 常用命令

```bash
npm run dev          # 本地开发
npm run lint         # oxlint + eslint
npm run type-check   # vue-tsc
npm run build-only   # 仅构建
npm run build        # 先 type-check 再构建
npm run test:unit    # Vitest
npm run test:e2e     # Playwright
```

## 当前目录结构（简版）

```text
src/
├── components/
│   ├── common/
│   ├── layout/
│   └── pages/
├── composables/
│   └── pages/
├── config/
├── layouts/
├── router/
├── services/
│   └── api/
├── stores/
│   └── modules/
├── styles/
│   ├── global.css
│   ├── legacy/
│   └── pages/
├── types/
├── utils/
└── views/
    ├── admin/
    ├── article/
    ├── collection/
    ├── home/
    └── user/
```

## 架构约定

- 组件使用 `<script setup lang="ts">` + Composition API。
- API 调用通过 `services/api/*`，请求实例在 `services/http.ts`。
- 跨模块状态通过 Pinia（`stores/modules/*`）。
- 路由集中在 `router/routes.ts`，并使用懒加载。
- 全局主题变量在 `styles/global.css`，页面样式分 `legacy` 与 `pages`。

## 与《前端开发指南》对齐状态（截至 2026-03-05）

### 已对齐

- TypeScript 严格模式已开启（`tsconfig.app.json`）。
- 全站使用 Composition API（无 Options API 组件）。
- 路由组件懒加载（`routes.ts`）。
- Ant Design Vue 按需加载（`unplugin-vue-components`）。
- 构建前执行类型检查（`npm run build`）。
- Vite 已配置 `manualChunks` + `cssCodeSplit`。
- 首页首屏 Hero 图片已使用 WebP 并预加载（`index.html`）。

### 待继续对齐

- 样式入口仍为 `styles/global.css`，指南目标是 `styles/global.scss`。
- 多个页面样式块仍未 `scoped`（当前存在于 `DefaultLayout`、`HomePageContent`、`ArticleListPageContent`、`CollectionPageContent`、`ArticleDetailPageContent`）。
- ESLint 当前使用 `vue flat/essential`，不是指南中的 `vue3-recommended` 目标级别。
- `.vue` 文件中的 `explicit-function-return-type` 仍为关闭状态（见 `eslint.config.ts` 的 `app/vue-sfc-rules`）。

## 代码规范执行要点

- 禁止 `any/unknown`（由 ESLint 规则兜底）。
- 列表渲染必须带稳定 `:key`。
- 高频事件（如 `scroll`）应使用节流/防抖或 `requestAnimationFrame`。
- 涉及 `v-html` 的页面需注明安全边界并做内容清洗。

## 后端接口（主要）

- 门户：`/home/summary/`、`/articles/`、`/articles/{id}/`、`/categories/tree/`、`/collections/`
- 认证：`/auth/login/`、`/auth/logout/`、`/auth/profile/`
- 后台：文章/分类/评论/合集/媒体库/日志相关管理接口

## 建议工作流

1. 开发前先同步接口类型到 `types/*` 与 `services/api/*`。
2. 页面复杂逻辑优先沉淀到 `composables/pages/*`。
3. 提交前至少执行：

```bash
npm run lint
npm run type-check
npm run build-only
```

4. PR 中说明：影响模块、回归点、是否涉及样式全局影响。

