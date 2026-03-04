import type { RouteRecordRaw } from 'vue-router'

import AdminLayout from '@/layouts/AdminLayout.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import AdminArticlePage from '@/views/admin/AdminArticlePage.vue'
import AdminCategoriesPage from '@/views/admin/AdminCategoriesPage.vue'
import AdminCommentsPage from '@/views/admin/AdminCommentsPage.vue'
import AdminCollectionsPage from '@/views/admin/AdminCollectionsPage.vue'
import AdminDashboardPage from '@/views/admin/AdminDashboardPage.vue'
import AdminLoginPage from '@/views/admin/AdminLoginPage.vue'
import AdminLogoutPage from '@/views/admin/AdminLogoutPage.vue'
import AdminMediaPage from '@/views/admin/AdminMediaPage.vue'
import AdminPersonalSettingsPage from '@/views/admin/AdminPersonalSettingsPage.vue'
import AdminSuperRedirectPage from '@/views/admin/AdminSuperRedirectPage.vue'

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
      { path: 'index/', name: 'home', component: () => import('@/views/home/HomePage.vue') },
      { path: 'articles', redirect: { name: 'article-list' } },
      { path: 'articles/', name: 'article-list', component: () => import('@/views/article/ArticleListPage.vue') },
      {
        path: 'category/:categoryId(\\d+)/',
        name: 'category',
        component: () => import('@/views/article/ArticleListPage.vue'),
      },
      {
        path: 'collections/:collectionId(\\d+)/',
        name: 'collection',
        component: () => import('@/views/collection/CollectionPage.vue'),
      },
      { path: 'query/', name: 'query', component: () => import('@/views/article/ArticleListPage.vue') },
      { path: 'about/', name: 'about', component: () => import('@/views/article/AboutPage.vue') },
      { path: 'contact/', name: 'contact', component: () => import('@/views/article/ContactPage.vue') },
      {
        path: 'article_detail/:id(\\d+)/',
        name: 'article-detail',
        component: () => import('@/views/article/ArticleDetailPage.vue'),
      },
      {
        path: 'articles/:id(\\d+)',
        redirect: (to) => ({ name: 'article-detail', params: { id: to.params.id } }),
      },
      { path: 'login', name: 'login', component: () => import('@/views/user/LoginPage.vue') },
    ],
  },
]
