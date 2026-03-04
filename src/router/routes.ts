import type { RouteRecordRaw } from 'vue-router'

type RouteComponentLoader = NonNullable<RouteRecordRaw['component']>

const AdminLayout: RouteComponentLoader = () => import('@/layouts/AdminLayout.vue')
const DefaultLayout: RouteComponentLoader = () => import('@/layouts/DefaultLayout.vue')

const AdminArticlePage: RouteComponentLoader = () => import('@/views/admin/AdminArticlePage.vue')
const AdminCategoriesPage: RouteComponentLoader = () => import('@/views/admin/AdminCategoriesPage.vue')
const AdminCommentsPage: RouteComponentLoader = () => import('@/views/admin/AdminCommentsPage.vue')
const AdminCollectionsPage: RouteComponentLoader = () => import('@/views/admin/AdminCollectionsPage.vue')
const AdminDashboardPage: RouteComponentLoader = () => import('@/views/admin/AdminDashboardPage.vue')
const AdminLoginPage: RouteComponentLoader = () => import('@/views/admin/AdminLoginPage.vue')
const AdminLogoutPage: RouteComponentLoader = () => import('@/views/admin/AdminLogoutPage.vue')
const AdminMediaPage: RouteComponentLoader = () => import('@/views/admin/AdminMediaPage.vue')
const AdminLogsPage: RouteComponentLoader = () => import('@/views/admin/AdminLogsPage.vue')
const AdminPersonalSettingsPage: RouteComponentLoader = () => import('@/views/admin/AdminPersonalSettingsPage.vue')
const AdminSuperRedirectPage: RouteComponentLoader = () => import('@/views/admin/AdminSuperRedirectPage.vue')

const HomePage: RouteComponentLoader = () => import('@/views/home/HomePage.vue')
const ArticleListPage: RouteComponentLoader = () => import('@/views/article/ArticleListPage.vue')
const CollectionPage: RouteComponentLoader = () => import('@/views/collection/CollectionPage.vue')
const AboutPage: RouteComponentLoader = () => import('@/views/article/AboutPage.vue')
const ContactPage: RouteComponentLoader = () => import('@/views/article/ContactPage.vue')
const ArticleDetailPage: RouteComponentLoader = () => import('@/views/article/ArticleDetailPage.vue')
const LoginPage: RouteComponentLoader = () => import('@/views/user/LoginPage.vue')

export const routes: RouteRecordRaw[] = [
  {
    path: '/admin/login/',
    name: 'admin-login',
    component: AdminLoginPage,
  },
  {
    path: '/admin/logout/',
    name: 'admin-logout',
    component: AdminLogoutPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/admin/dashboard/super_admin/',
    name: 'admin-super-redirect',
    component: AdminSuperRedirectPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/admin/',
    component: AdminLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/admin/dashboard/' },
      { path: 'dashboard/', name: 'admin-dashboard', component: AdminDashboardPage },
      {
        path: 'manage_articles/',
        name: 'admin-manage-articles',
        component: AdminArticlePage,
      },
      {
        path: 'create_article/',
        name: 'admin-create-article',
        component: AdminArticlePage,
      },
      {
        path: 'create_article/:articleId(\\d+)/',
        name: 'admin-edit-article',
        component: AdminArticlePage,
      },
      {
        path: 'manage_comments/',
        name: 'admin-manage-comments',
        component: AdminCommentsPage,
      },
      {
        path: 'manage_categories/',
        name: 'admin-manage-categories',
        component: AdminCategoriesPage,
      },
      {
        path: 'manage_collections/',
        name: 'admin-manage-collections',
        component: AdminCollectionsPage,
      },
      {
        path: 'pic_management/',
        name: 'admin-media-root',
        component: AdminMediaPage,
      },
      {
        path: 'manage_logs/',
        name: 'admin-manage-logs',
        component: AdminLogsPage,
      },
      {
        path: 'pic_management/:pathMatch(.*)*',
        name: 'admin-media',
        component: AdminMediaPage,
      },
      {
        path: 'personal_settings/',
        name: 'admin-personal-settings',
        component: AdminPersonalSettingsPage,
      },
    ],
  },
  {
    path: '/admin',
    redirect: '/admin/dashboard/',
  },
  {
    path: '/',
    component: DefaultLayout,
    children: [
      { path: '', redirect: { name: 'home' } },
      { path: 'index/', name: 'home', component: HomePage },
      { path: 'articles', redirect: { name: 'article-list' } },
      { path: 'articles/', name: 'article-list', component: ArticleListPage },
      {
        path: 'category/:categoryId(\\d+)/',
        name: 'category',
        component: ArticleListPage,
      },
      {
        path: 'collections/:collectionId(\\d+)/',
        name: 'collection',
        component: CollectionPage,
      },
      { path: 'query/', name: 'query', component: ArticleListPage },
      { path: 'about/', name: 'about', component: AboutPage },
      { path: 'contact/', name: 'contact', component: ContactPage },
      {
        path: 'article_detail/:id(\\d+)/',
        name: 'article-detail',
        component: ArticleDetailPage,
      },
      {
        path: 'articles/:id(\\d+)',
        redirect: (to) => ({ name: 'article-detail', params: { id: to.params.id } }),
      },
      { path: 'login', name: 'login', component: LoginPage },
    ],
  },
]
