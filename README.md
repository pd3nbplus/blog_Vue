# blog_vue Frontend

博客前端工程（门户 + 后台管理），基于 `Vue 3 + TypeScript + Pinia + Vue Router + Ant Design Vue`。

![门户页面示意](image.png)

![后台页面示意](image-1.png)

## 1. 📌 项目简介（面向使用者）

这是一个博客系统前端，包含两部分：

- 门户站点：浏览首页、文章列表、文章详情、分类与合集，支持搜索。
- 后台管理：文章/分类/评论/合集管理，媒体库、日志、个人设置等能力。

访问路径示例：

- 门户首页：`/index/`
- 后台首页：`/admin/dashboard/`
- 后台登录：`/admin/login/`

## 2. 🚀 快速开始（面向开发者）

1. 安装依赖

```bash
npm install
```

2. 配置环境变量（参考 `.env.example`）

```bash
VITE_API_BASE_URL=/api/v1
```

3. 启动开发

```bash
npm run dev
```

默认端口：`5174`

## 3. 🛠️ 常用命令

```bash
npm run dev          # 本地开发
npm run lint         # oxlint + eslint
npm run type-check   # vue-tsc
npm run build-only   # 仅构建
npm run build        # type-check + build
npm run test:unit    # Vitest
npm run test:e2e     # Playwright
```

## 4. 技术栈与版本

- `vue@3.5.x`
- `typescript@5.9.x`（`strict: true` + `noUncheckedIndexedAccess: true`）
- `vite@7.x`
- `vue-router@4.x`
- `pinia@3.x`
- `ant-design-vue@4.x`（`unplugin-vue-components` 自动按需注册）
- 其他核心依赖：`axios`、`markdown-it`、`katex`、`dompurify`
- 工程链路：`eslint + oxlint + prettier + vue-tsc + vitest + playwright`

## 5. 🧱 目录与职责（可扩展基线）

```text
src/
├── __tests__/                  # 测试文件
├── components/                 # 可复用组件
│   ├── common/                 # 通用展示组件（卡片、图片、树等）
│   ├── layout/                 # 历史布局组件（当前基本已弃用）
│   └── pages/                  # 按业务域拆分的页面子组件
├── composables/                # 组合式逻辑
│   └── pages/                  # 页面级逻辑 hooks（useXxxPage）
├── config/                     # 环境与运行配置
├── layouts/                    # 路由布局壳（Default/Admin）
├── router/                     # 路由表、路由入口、路由守卫
├── services/                   # 请求封装与接口服务
│   └── api/                    # 按业务域拆分 API
├── stores/                     # Pinia 状态管理
│   └── modules/                # 业务模块 store
├── styles/                     # 样式体系
│   ├── legacy/                 # 兼容历史页面样式
│   └── pages/                  # 页面级样式补充
├── types/                      # TS 类型定义（接口/DTO/业务模型）
├── utils/                      # 工具函数与基础能力
└── views/                      # 路由页面入口
    ├── admin/                  # 后台页面
    ├── article/                # 文章域页面
    ├── collection/             # 合集域页面
    ├── home/                   # 首页
    └── user/                   # 用户域页面
```

推荐的新增功能落位规则：

- 新页面：`views/<domain>/<Page>.vue`
- 页面复杂逻辑：`composables/pages/use<Page>.ts`
- 接口调用：`services/api/<domain>.ts`
- 类型：`types/<domain>.ts`
- 可复用业务组件：`components/pages/<domain>/...`
- 若存在跨页面状态：`stores/modules/<domain>.ts`

## 6. 🧩 运行时架构约定

- 仅使用 Composition API（`<script setup lang="ts">`）。
- 路由定义集中在 `router/routes.ts`，页面组件全部懒加载。
- 鉴权在 `router/guards.ts`：后台路由统一校验登录态。
- HTTP 统一走 `services/http.ts`（注入 token、统一错误处理）。
- 主题能力由 `composables/useTheme.ts` 管理，入口在 `main.ts` 初始化。
- 动态 favicon 由 `composables/useDynamicFavicon.ts` 在入口初始化。

### 6.1 🗂️ 文章列表功能应该写到哪里（示例）

以“文章列表页”这条链路为例，推荐固定分层：

- 路由入口：`src/router/routes.ts`
- 页面壳组件：`src/views/article/ArticleListPage.vue`
- 页面展示组件：`src/components/pages/article/ArticleListPageContent.vue`
- 页面逻辑组合式函数：`src/composables/pages/useArticleListPage.ts`
- 状态管理：`src/stores/modules/article.ts`
- 接口层：`src/services/api/article.ts`
- 类型定义：`src/types/article.ts`

### 6.2 🔧 开发流程示例（逻辑、接口、状态）

1. 先定义接口和类型

```ts
// src/services/api/article.ts
export interface ArticleListQuery {
  page?: number
  page_size?: number
  q?: string
  category?: number
}

export async function getArticleList(params: ArticleListQuery) {
  const { data } = await request.get('/articles/', { params })
  return data
}
```

2. 在 store 中封装“可复用状态 + 拉取动作”

```ts
// src/stores/modules/article.ts
export const useArticleStore = defineStore('article', () => {
  const list = ref<ArticleItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(10)

  async function fetchArticleList(params: ArticleListQuery = {}): Promise<void> {
    const res = await getArticleList(params)
    list.value = res.data.results
    total.value = res.data.count
    page.value = res.data.page
    pageSize.value = res.data.page_size
  }

  return { list, total, page, pageSize, fetchArticleList }
})
```

3. 在 composable 中处理路由参数、筛选和分页行为

```ts
// src/composables/pages/useArticleListPage.ts
export function useArticleListPage() {
  const route = useRoute()
  const router = useRouter()
  const articleStore = useArticleStore()

  async function fetchList(currentPage = 1): Promise<void> {
    await articleStore.fetchArticleList({ page: currentPage })
  }

  function handlePageChange(currentPage: number): void {
    void router.push({ name: 'article-list', query: { page: String(currentPage) } })
  }

  return { fetchList, handlePageChange }
}
```

4. 页面组件只负责装配，尽量不堆业务逻辑

```vue
<!-- src/views/article/ArticleListPage.vue -->
<script setup lang="ts">
import ArticleListPageContent from '@/components/pages/article/ArticleListPageContent.vue'
</script>

<template>
  <ArticleListPageContent />
</template>
```

这套分层的目标：

- `services` 关注“怎么请求”。
- `store` 关注“共享状态和领域动作”。
- `composable` 关注“页面交互与路由联动”。
- `view/component` 关注“渲染和交互绑定”。

## 7. ✅ 与《前端开发指南》对齐状态（截至 2026-03-06）

已对齐：

- TypeScript 严格模式开启（`tsconfig.app.json`）。
- 全项目使用 Composition API，无 Options API。
- 路由懒加载（`src/router/routes.ts`）。
- Ant Design Vue 按需加载（`vite.config.ts` + resolver）。
- 构建前强制类型检查（`npm run build` -> `vue-tsc --build`）。
- Vite 已启用 `cssCodeSplit` 与 `manualChunks` 分包策略。
- ESLint 已启用 `@typescript-eslint/no-explicit-any`。
- ESLint 已启用 `@typescript-eslint/explicit-function-return-type`（含 `.vue`）。
- ESLint 已启用 `vue/require-explicit-emits`。

部分对齐（仍需演进）：

- 样式体系仍以 `styles/global.css` 为入口，尚未切换到 SCSS 体系。
- 仍存在非 `scoped` 样式块（用于布局壳和内容渲染覆盖），涉及：`src/layouts/DefaultLayout.vue`。
- 仍存在非 `scoped` 样式块（用于布局壳和内容渲染覆盖），涉及：`src/components/pages/home/HomePageContent.vue`。
- 仍存在非 `scoped` 样式块（用于布局壳和内容渲染覆盖），涉及：`src/components/pages/article/ArticleListPageContent.vue`。
- 仍存在非 `scoped` 样式块（用于布局壳和内容渲染覆盖），涉及：`src/components/pages/article/ArticleDetailPageContent.vue`。
- 仍存在非 `scoped` 样式块（用于布局壳和内容渲染覆盖），涉及：`src/components/pages/collection/CollectionPageContent.vue`。

建议的下一步对齐顺序：

1. 增加非 `scoped` 样式白名单注释规范（说明原因与影响范围）。
2. 逐步引入 `styles/*.scss` 并迁移变量/混入层。
3. 为高频业务模块补齐单元测试基线（优先 composables 与 services）。
4. 继续收敛 `legacy` 样式，拆分为按域样式文件。

## 8. 📋 后续开发流程（建议）

1. 先定义类型：`types/<domain>.ts`。
2. 再实现服务：`services/api/<domain>.ts`。
3. 页面逻辑落 `composables/pages`，视图组件保持轻量。
4. 提交前最少执行：

```bash
npm run lint
npm run type-check
npm run build-only
```

5. PR 描述必须包含：
- 影响范围（门户/后台、具体页面）。
- 接口与类型变更点。
- 回归点（登录态、路由守卫、主题切换、移动端样式）。
