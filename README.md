# blog_vue Frontend

基于 `Vue 3 + TypeScript + Pinia + Ant Design Vue + Axios + Vue Router` 的博客前端。

## 1. 已落地架构

```text
src/
├── components/
│   └── Layout/AppHeader.vue
├── config/env.ts
├── layouts/DefaultLayout.vue
├── router/
│   ├── index.ts
│   ├── routes.ts
│   └── guards.ts
├── services/
│   ├── request.ts
│   ├── article.ts
│   └── user.ts
├── stores/
│   ├── index.ts
│   └── modules/
│       ├── article.ts
│       └── user.ts
├── styles/global.css
├── types/
│   ├── api.ts
│   ├── article.ts
│   └── user.ts
├── utils/storage.ts
├── views/
│   ├── home/HomePage.vue
│   ├── article/ArticleListPage.vue
│   ├── article/ArticleDetailPage.vue
│   └── user/LoginPage.vue
├── App.vue
└── main.ts
```

## 2. 规范执行说明

- 全局 API 通过 `services/request.ts` 统一封装。
- 组件不直接请求后端，统一由 `stores/modules/*` 调用服务层。
- 响应数据统一按 `{ code, message, data }` 解析。
- Token 通过拦截器自动注入，401/403/5xx 统一错误处理。
- 保持 TypeScript 类型约束，不使用 `any`。

## 3. 环境变量

新建 `.env.development`（仓库已提供示例值）：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8001/api/v1
```

## 4. 本地开发

```bash
npm install
npm run dev
```

默认开发端口已配置为 `5174`（`vite --host 0.0.0.0 --port 5174`）。

## 5. 对接的后端接口

- `GET /home/summary/`
- `GET /articles/`
- `GET /articles/{id}/`
- `GET /categories/tree/`
- `POST /auth/login/`
- `POST /auth/logout/`
- `GET /auth/profile/`

## 6. 后续扩展建议（最佳实践补充）

- 增加 `v-permission` 指令实现按钮级权限控制。
- 增加管理端页面并对接 `/admin/articles/` 进行文章发布与编辑。
- 引入 `markdown-it` 预览组件用于编辑器本地预览。
- 补充 Vitest 与 Playwright 覆盖登录、列表、详情主链路。
