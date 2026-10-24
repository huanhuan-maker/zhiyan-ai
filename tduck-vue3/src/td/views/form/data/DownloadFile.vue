<template>
  <el-dialog title="导出" v-model="dialogVisible" width="30%" center append-to-body>
    默认导出当前页显示数据，建议导出筛选后的数据，可以调整当页大小导出更多数据，<span class="text-danger"
      >导出全量数据可能会导致占用太多资源，影响系统正常使用！</span
    >
    <el-switch
      v-model="allDownload"
      class="m20"
      active-text="导出全量数据"
      inactive-text="导出当前页数据"
      active-color="#ed5565"
      @change="changeAllDownload"
    />
    <template #footer><span  class="dialog-footer">
      <el-button @click="dialogVisible = false">取 消</el-button>
      <el-button type="primary" @click="handleDownload">确 定</el-button>
    </span></template>
  </el-dialog>
</template>

<script>
import { downloadFormDataFileRequest } from '../../../api/project/data'

export default {
  name: 'DownloadFile',
  props: {
    queryParams: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      // 全量导出
      allDownload: false,
      dialogVisible: false
    }
  },
  methods: {
    openDownloadFile() {
      this.dialogVisible = true
    },
    changeAllDownload(val) {
      this.allDownload = val
    },
    handleDownload() {
      this.dialogVisible = false
      let params = JSON.parse(JSON.stringify(this.queryParams))
      if (this.allDownload) {
        params.size = null
        params.current = null
      }
      downloadFormDataFileRequest(params).then((res) => {
        this.$process({
          tips: '* 导出当前筛选出的全部附件',
          message: '附件导出中',
          key: res.data
        })
      })
    }
  }
}
</script>

<style scoped></style>
