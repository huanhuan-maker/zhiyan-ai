export default [
{
    path: '/redirect/:type',
    meta: { requireLogin: false },
    component: () => import(/* webpackChunkName: 'root' */ '@/views/redirect')
  },
  {
    path: '/account/validate',
    meta: { requireLogin: false },
    component: () => import(/* webpackChunkName: 'root' */ '@/views/account/validate')
  },
  {
    path: '/forget/password',
    meta: { requireLogin: false },
    component: () => import(/* webpackChunkName: 'root' */ '@/views/account/ForgetPwd')
  },
  {
    path: '/',
    meta: { requireLogin: false },
    component: () => import(/* webpackChunkName: 'root' */ '@/views/home/index.vue')
  },
  {
    path: '/login',
    meta: { requireLogin: false },
    component: () => import(/* webpackChunkName: 'root' */ '@/views/account/login/index')
  },
  {
    path: '/home',
    meta: { requireLogin: true },
    component: () => import(/* webpackChunkName: 'root' */ '@/views/home'),
    children: [
      {
        path: '/',
        meta: { requireLogin: true },
        component: () => import(/* webpackChunkName: 'root' */ '@/views/project/my/index')
      },
      {
        path: 'member',
        meta: { requireLogin: true },
        component: () => import(/* webpackChunkName: 'root' */ '@/views/account/member')
      },
      {
        path: 'assistant',
        meta: { requireLogin: true, title: '问卷助手' },
        component: () => import('@/views/assistant/index.vue')
      }
    ]
  },
  {
    path: '/manage',
    meta: { requireLogin: true },
    component: () => import(/* webpackChunkName: 'root' */ '@/views/home'),
    children: [
      {
        path: 'user',
        meta: { requireLogin: true },
        component: () => import(/* webpackChunkName: 'root' */ '@/views/manage/user')
      },
      {
        path: 'system',
        meta: { requireLogin: true },
        component: () => import(/* webpackChunkName: 'root' */ '@/views/manage/system')
      }
    ]
  }
]
