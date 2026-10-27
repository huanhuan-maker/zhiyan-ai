<template>
  <div>
    <textarea v-if="!inline" :id="tinymceId" />
    <!--    内联模式-->
    <div v-else :id="`${tinymceId}inline`" />
  </div>
</template>

<script>
import { inlineToolbar, plugins, toolbar } from './config'
import loadTinymce from '../../utils/loadTinymce'
import _ from 'lodash'
import store from '@/store'

let num = 1

export default {
  name: 'FormTinymce',
  props: {
    disabled: Boolean,
    id: {
      type: String,
      default: () => {
        num === 10000 && (num = 1)
        return `tinymce${+new Date()}${num++}`
      }
    },
    value: {
      default: ''
    },
    toolbar: [],
    // 内联模式
    inline: {
      type: Boolean,
      default: false
    },
    formItemId: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      tinymceId: this.id,
      showFieldSelect: false,
      editor: null
    }
  },
  watch: {
    disabled(value) { this.editor?.mode?.set(value ? 'readonly' : 'design') },
    // 实现v-model更新内容
    value(val, oldVal) {
      if (this.editor && val !== oldVal && val !== this.editor.getContent()) {
        this.editor.setContent(val)
      }
    }
  },
  mounted() {
    const uploadUrl = `${process.env.VUE_APP_API_ROOT}/user/file/upload`
    // eslint-disable-next-line global-require
    let finalToolbar = []
    if (this.inline) {
      finalToolbar = this.toolbar ? this.toolbar : inlineToolbar
    } else {
      finalToolbar = this.toolbar ? this.toolbar : toolbar
    }
    let that = this
    let conf = {
      readonly: this.disabled,
      selector: `#${this.tinymceId}${this.inline ? 'inline' : ''}`,
      language: 'zh_CN',
      menubar: 'false',
      placeholder: this.placeholder,
      // 工作台固定深色：编辑器 UI 与内容区统一用 TinyMCE 自带深色皮肤
      skin: 'oxide-dark',
      cache_suffix: '?v=0.0.6',
      plugins,
      inline: this.inline,
      toolbar: finalToolbar,
      toolbar_drawer: 'sliding',
      entity_encoding: 'row', // 所有字符都将以非实体形式保存，避免出现部分符号变成 html 编码
      toolbar_mode: 'sliding',
      height: 200,
      //div[*] 表示允许 <div> 标签以及所有的属性。
      extended_valid_elements: 'formvariable[*]',
      custom_elements: 'formvariable[*]',
      content_css: ['/tinymce/skins/editor.css', '/tinymce/skins/content/dark/content.min.css'],
      content_style: 'body{background:#142235;color:#b8c4d4;} a{color:#88b0ff;} code,pre{background:#111e30;color:#d7e2f0;}',
      fontsize_formats: '11px 12px 14px 16px 18px 24px 36px 48px',
      branding: false,
      object_resizing: false,
      end_container_on_empty_block: true,
      powerpaste_word_import: 'clean',
      code_dialog_height: 450,
      code_dialog_width: 1000,
      advlist_bullet_styles: 'square',
      advlist_number_styles: 'default',
      default_link_target: '_blank',
      link_title: false,
      statusbar: false,
      promotion: false,
      // image_dimensions: false, // 禁用输入图片宽高
      // content_style: "img {max-width:100%;}",
      nonbreaking_force_tab: true,
      images_upload_handler(blobInfo, succFun, failFun) {
        const file = blobInfo.blob() // 转化为易于理解的file对象
        const xhr = new XMLHttpRequest()
        xhr.withCredentials = false
        xhr.open('POST', uploadUrl)
        xhr.setRequestHeader(`token`, store.state.user.token)
        xhr.onload = function () {
          if (xhr.status !== 200) {
            failFun(`HTTP Error: ${xhr.status}`)
            return
          }
          const json = JSON.parse(xhr.responseText)
          if (!json || typeof json.data !== 'string') {
            failFun(`Invalid JSON: ${xhr.responseText}`)
            return
          }
          succFun(json.data)
        }
        const formData = new FormData()
        formData.append('file', file, file.name) // 此处与源文档不一样
        xhr.send(formData)
      },
      file_picker_callback: function (cb, value, meta) {
        //以下是原生上传文件
        let input = document.createElement('input')
        input.setAttribute('type', 'file')
        input.click()
        input.onchange = function () {
          const xhr = new XMLHttpRequest()
          xhr.withCredentials = false
          xhr.open('POST', uploadUrl)
          xhr.setRequestHeader(`token`, store.state.user.token)
          xhr.onload = function () {
            if (xhr.status !== 200) {
              return
            }
            const json = JSON.parse(xhr.responseText)
            if (!json || typeof json.data !== 'string') {
              return
            }
            cb(json.data, { text: json.data })
          }
          const formData = new FormData()
          const file = input.files[0]
          formData.append('file', file, file.name) // 此处与源文档不一样
          xhr.send(formData)
        }
      }
    }
    loadTinymce((tinymce) => {
      conf = Object.assign(conf, this.$attrs)
      conf.init_instance_callback = (editor) => {
        this.editor = editor
        if (this.value) editor.setContent(this.value)
        editor.on('input change keyup undo redo', () => {
          editor.save()
          this.$emit('update:value', editor.getContent())
        })
        editor.on('blur', () => {
          this.$emit('blur')
        })
      }
      tinymce.init(conf)
    })
    // 监听页面滚动事件
    this.scrollHandler = _.throttle(() => {
      if (this.inline && this.editor) this.editor.getElement().blur()
    }, 100)
    window.addEventListener('scroll', this.scrollHandler, true)
  },
  unmounted() {
    // 监听页面滚动事件
    window.removeEventListener('scroll', this.scrollHandler, true)
    this.scrollHandler?.cancel()
    this.destroyTinymce()
  },
  methods: {
    handleInsertContent(content) {
      this.editor.insertContent(content)
    },
    destroyTinymce() {
      if (!window.tinymce) return
      const tinymceInstance = window.tinymce.get(`${this.tinymceId}${this.inline ? 'inline' : ''}`)
      if (tinymceInstance) {
        tinymceInstance.destroy()
      }
    }
  }
}
</script>
<style>
/* 在el-dialog中tinymce z-index 被太小而被遮挡时要加这两句 */
.tox-tinymce-aux {
  z-index: 99999 !important;
}

.tinymce.ui.FloatPanel {
  z-index: 99;
}
</style>
