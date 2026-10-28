import { deleteFormRequest, stopFormRequest, logicDeleteFormRequest } from '@/api/project/form'
import dayjs from 'dayjs'

export default {
  props: [],
  data() {
    return {
      folderId: 0,
      projectStatusList: [
        { code: '', name: '全部', color: '#2563eb' },
        { code: 1, name: '待发布', color: '#d97706' },
        { code: 2, name: '收集中', color: '#16a34a' },
        { code: 3, name: '已停止', color: '#dc2626' }
      ],
      projectTypeList: [
        { code: '', name: '全部', color: '#2563eb' },
        { code: 1, name: '表单', color: '#2563eb' },
        { code: 2, name: '流程', color: '#d97706' },
        { code: 4, name: '考试', color: '#16a34a' }
      ]
    }
  },
  methods: {
    formatDate(time) {
      return dayjs(time).format('YYYY/MM/DD')
    },
    getType(key) {
      const item = this.projectTypeList.find((e) => e.code === key)
      return item || { name: '', color: '' }
    },
    // 逻辑删除：返回 Promise，调用方（如按住删除浮层）可据此关闭浮层或展示失败提示。
    logicDeleteForm(key) {
      return logicDeleteFormRequest({ formKey: key }).then((res) => {
        if (!res.data) throw new Error('删除失败')
        this.msgSuccess('删除成功')
        this.$emit('refresh')
        return true
      })
    },
    deleteForm(key) {
      deleteFormRequest({ formKey: key }).then((res) => {
        if (res.data) {
          this.msgSuccess('刪除成功')
          this.$emit('refresh')
        }
      })
    },
    stopProject(key) {
      stopFormRequest({ formKey: key }).then((res) => {
        if (res.data) {
          this.msgSuccess('停止成功')
          this.$emit('refresh')
        }
      })
    },
    toProjectHandle(form, type) {
      this.$router.push({
        path: `/project/form/${type}`,
        query: { key: form.formKey, active: type, type: form.type }
      })
    }
  }
}
