export default [
  {
    path: '/project',
    meta: { requireLogin: true },
    component: () => import(/* webpackChunkName: 'root' */ '@/views/home'),
    children: [
      {
        path: 'my',
        meta: { requireLogin: true },
        component: () => import(/* webpackChunkName: 'root' */ '@/views/project/my/index')
      },
      // Retired workspace modules: no page imports or template creation entry remain.
      ...['recycle', 'template', 'template/category', 'theme/category', 'theme/index', 'template/preview']
        .map(path => ({ path, meta: { requireLogin: true }, redirect: () => ({ path: '/home', query: {}, hash: '' }) }))
    ]
  },
  {
    path: '/project/form/view',
    meta: { requireLogin: false },
    component: () => import(/* webpackChunkName: 'root' */ '@/views/form/preview/ProjectForm.vue')
  },
  {
    path: '/project/public/result',
    meta: { requireLogin: false },
    component: () => import(/* webpackChunkName: 'root' */ '@/views/form/statistics/public')
  },
  {
    path: '/s/:key',
    meta: { requireLogin: false },
    component: () => import(/* webpackChunkName: 'root' */ '@/views/form/write')
  },
  {
    path: '/project/write',
    meta: { requireLogin: false },
    component: () => import(/* webpackChunkName: 'root' */ '@/views/form/write')
  }
]
