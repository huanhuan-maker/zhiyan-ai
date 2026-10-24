// Data schema recovered from the locally installed TDuck generator 2.0.5.
var formConf = {
  formRef: 'elForm',
  formModel: 'formData',
  size: 'mini',
  labelPosition: 'top',
  labelWidth: 100,
  formRules: 'rules',
  gutter: 20,
  disabled: false,
  span: 24,
  title: '<h3 style="text-align: center;" data-mce-style="text-align: center;">问卷名称</h3>',
  description: '<p style="text-align: center;" data-mce-style="text-align: center;">感谢您能抽出几分钟时间来参加本次表单填写，现在我们就马上开始吧！</p>',
  formBtns: true,
  unFocusedComponentBorder: true
};

// 基础组件 【基础组件】
var basicComponents = [{
  // 组件的自定义配置
  typeId: 'INPUT',
  config: {
    label: '单行文本',
    labelWidth: null,
    showLabel: true,
    changeTag: true,
    tag: 't-input',
    tagIcon: 'input',
    defaultValue: undefined,
    required: true,
    span: 24,
    // 正则校验规则
    regList: [],
    prepend: '',
    append: '',
    // 数据类型
    dataType: {
      type: '',
      message: ''
    }
  },
  // 其余的为可直接写在组件标签上的属性
  placeholder: '请输入',
  style: {
    width: '100%'
  },
  clearable: true,
  'prefix-icon': '',
  'suffix-icon': '',
  minlength: null,
  maxlength: null,
  'show-word-limit': false,
  readonly: false,
  disabled: false,
  // 不允许重复数据
  notRepeat: false
}, {
  // 组件的自定义配置
  typeId: 'NUMBER',
  config: {
    label: '数字组件',
    labelWidth: null,
    showLabel: true,
    changeTag: true,
    tag: 't-number',
    tagIcon: 'number',
    defaultValue: undefined,
    required: true,
    span: 24,
    // 正则校验规则
    regList: []
  },
  // 其余的为可直接写在组件标签上的属性
  placeholder: '请输入',
  style: {
    width: '100%'
  },
  min: null,
  max: 100000000,
  step: 1,
  precision: null,
  disabled: false
}, {
  typeId: 'TEXTAREA',
  config: {
    label: '多行文本',
    labelWidth: null,
    showLabel: true,
    tag: 'el-input',
    tagIcon: 'textarea',
    defaultValue: undefined,
    required: true,
    span: 24,
    regList: [],
    changeTag: true
  },
  type: 'textarea',
  placeholder: '请输入',
  autosize: {
    minRows: 4,
    maxRows: 4
  },
  style: {
    width: '100%'
  },
  minlength: null,
  maxlength: null,
  'show-word-limit': false,
  readonly: false,
  disabled: false
}, {
  typeId: 'DATE',
  config: {
    label: '日期时间',
    tag: 't-date-time',
    tagIcon: 'date',
    defaultNowTime: false,
    defaultValue: null,
    showLabel: true,
    labelWidth: null,
    span: 24,
    required: true,
    regList: [],
    changeTag: true
  },
  placeholder: '请选择',
  type: 'date',
  style: {
    width: '100%'
  },
  disabled: false,
  clearable: true,
  format: 'yyyy-MM-dd',
  'value-format': 'yyyy-MM-dd',
  readonly: false
}, {
  typeId: 'RATE',
  config: {
    label: '评分组件',
    tag: 't-rate',
    tagIcon: 'rate',
    defaultValue: 0,
    span: 24,
    showLabel: true,
    showRegList: false,
    labelWidth: null,
    required: true,
    regList: [],
    changeTag: true
  },
  style: {},
  max: 5,
  'allow-half': false,
  'show-text': false,
  'show-score': false,
  disabled: false
}, {
  typeId: 'UPLOAD',
  config: {
    label: '文件上传',
    tag: 't-upload',
    tagIcon: 'upload',
    defaultValue: null,
    showLabel: true,
    showRegList: false,
    labelWidth: null,
    required: true,
    span: 24,
    showTip: false,
    buttonText: '点击上传',
    regList: [],
    changeTag: true,
    fileSize: 10,
    sizeUnit: 'MB'
  },
  action: "/form/file/upload/",
  disabled: false,
  accept: '',
  name: 'file',
  'auto-upload': true,
  'list-type': 'text',
  limit: 2,
  multiple: false
}, {
  typeId: 'IMAGE_UPLOAD',
  config: {
    label: '图片上传',
    tag: 't-image-upload',
    tagIcon: 'image-upload',
    defaultValue: [],
    showLabel: true,
    showRegList: false,
    labelWidth: null,
    required: true,
    span: 24,
    showTip: false,
    buttonText: '点击上传',
    regList: [],
    changeTag: true,
    fileSize: 10,
    sizeUnit: 'MB'
  },
  action: "/form/file/upload/",
  disabled: false,
  accept: 'image/*',
  name: 'file',
  'auto-upload': true,
  limit: 2,
  multiple: false
}, {
  typeId: 'SORT',
  config: {
    label: '排序题型',
    tag: 't-sort',
    tagIcon: 'sort',
    defaultValue: [],
    span: 24,
    showLabel: true,
    showRegList: false,
    labelWidth: null,
    required: true,
    regList: [],
    changeTag: true
  },
  sortList: [{
    value: 1,
    label: '排序1'
  }, {
    value: 2,
    label: '排序2'
  }],
  style: {}
}, {
  typeId: 'SLIDER',
  config: {
    label: '滑块组件',
    tag: 't-slider',
    tagIcon: 'slider',
    defaultValue: 0,
    span: 24,
    showLabel: true,
    showRegList: false,
    labelWidth: null,
    required: true,
    regList: [],
    changeTag: true
  },
  style: {},
  max: 100,
  min: 0,
  step: 1
}, {
  typeId: 'SELECT',
  config: {
    label: '下拉选择',
    showLabel: true,
    labelWidth: null,
    tag: 't-select',
    tagIcon: 'select',
    mobileTag: 'mobile-t-select',
    span: 24,
    required: true,
    regList: [],
    changeTag: true,
    // 0 静态数据  1 动态数据
    optionsType: 0,
    dynamicOptions: {
      url: '',
      dataPath: '',
      valueField: '',
      labelField: ''
    },
    options: [{
      label: '选项一',
      value: 1
    }, {
      label: '选项二',
      value: 2
    }]
  },
  placeholder: '请选择',
  style: {
    width: '100%'
  },
  clearable: true,
  disabled: false,
  filterable: false,
  multiple: false
}, {
  typeId: 'CASCADER',
  config: {
    label: '级联选择',
    url: '',
    method: 'get',
    dataKey: 'list',
    showLabel: true,
    labelWidth: null,
    tag: 't-cascader',
    tagIcon: 'cascader',
    defaultValue: [],
    // dataType: 'static',
    span: 24,
    required: true,
    regList: [],
    changeTag: true,
    // 0 静态数据  1 动态数据
    optionsType: 0,
    dynamicOptions: {
      url: '',
      dataPath: '',
      valueField: '',
      labelField: '',
      childrenField: ''
    },
    options: [{
      id: 1,
      value: 1,
      label: '选项1',
      children: [{
        id: 2,
        value: 2,
        label: '选项1-1'
      }]
    }]
  },
  placeholder: '请选择',
  style: {
    width: '100%'
  },
  props: {
    props: {
      multiple: false,
      label: 'label',
      value: 'value',
      children: 'children'
    }
  },
  'show-all-levels': true,
  disabled: false,
  clearable: true,
  filterable: false,
  separator: '/'
}, {
  typeId: 'RADIO',
  config: {
    label: '单选框组',
    labelWidth: null,
    showLabel: true,
    showRegList: false,
    tag: 't-radio-group',
    tagIcon: 'radio',
    changeTag: true,
    defaultValue: undefined,
    inline: true,
    span: 24,
    optionType: 'default',
    regList: [],
    required: true,
    border: false,
    // 其他是否必填
    otherRequired: true,
    // 显示投票结果
    showVoteResult: false,
    // 0 静态数据  1 动态数据
    optionsType: 0,
    dynamicOptions: {
      url: '',
      dataPath: '',
      valueField: '',
      labelField: ''
    },
    options: [{
      label: '选项一',
      value: 1,
      quotaSetting: null // 名额设置
    }, {
      label: '选项二',
      value: 2,
      quotaSetting: null // 名额设置
    }],
    quotaBlankWarning: '',
    // 剩余名额为0时，显示文案
    quotaCycleRule: 'fixed',
    // 选项名额重置 fixed：不重置 per_day：按天 per_week：按周
    hideQuota: false,
    // 选项名额为空时隐藏选项
    hideChoiceWhenQuotaEmpty: false,
    // 不向填表者展示选项名额剩余数字
    quotaRecoverable: true // 删除数据后，选项名额自动恢复
  },
  style: {},
  size: 'medium',
  disabled: false
}, {
  typeId: 'CHECKBOX',
  config: {
    label: '多选框组',
    tag: 't-checkbox-group',
    tagIcon: 'checkbox',
    defaultValue: [],
    span: 24,
    showLabel: true,
    inline: false,
    showRegList: true,
    labelWidth: null,
    optionType: 'default',
    required: true,
    regList: [],
    changeTag: true,
    border: false,
    // 其他是否必填
    otherRequired: true,
    // 显示投票结果
    showVoteResult: false,
    // 0 静态数据  1 动态数据
    optionsType: 0,
    dynamicOptions: {
      url: '',
      dataPath: '',
      valueField: '',
      labelField: ''
    },
    options: [{
      label: '选项一',
      value: 1,
      quotaSetting: null // 名额设置
    }, {
      label: '选项二',
      value: 2,
      quotaSetting: null
    }],
    exclusiveChoiceApiCodes: [],
    // 互斥选项
    withExclusiveChoice: false,
    // 是否开启互斥

    quotaBlankWarning: '',
    // 剩余名额为0时，显示文案
    quotaCycleRule: 'fixed',
    // 选项名额重置 fixed：不重置 per_day：按天 per_week：按周

    hideQuota: false,
    // 选项名额为空时隐藏选项
    hideChoiceWhenQuotaEmpty: false,
    // 不向填表者展示选项名额剩余数字
    quotaRecoverable: true // 删除数据后，选项名额自动恢复
  },
  style: {},
  size: 'medium',
  min: null,
  max: null,
  disabled: false
}, {
  typeId: 'IMAGE_SELECT',
  config: {
    label: '图片选择',
    showLabel: true,
    labelWidth: null,
    defaultValue: null,
    showDefaultValue: true,
    showRequired: true,
    showClearable: false,
    showRegList: false,
    // 显示投票结果
    showVoteResult: false,
    tag: 't-image-select',
    tagIcon: 'image-select',
    span: 24,
    required: true,
    regList: [],
    changeTag: true,
    options: [{
      label: '选项一',
      value: 1
    }]
  },
  multiple: false,
  style: {
    width: '100%'
  }
}, {
  typeId: 'DIVIDER',
  config: {
    label: '分割线',
    defaultValue: '',
    displayType: true,
    showLabel: false,
    showDefaultValue: false,
    showRequired: false,
    showClearable: false,
    showRegList: false,
    tag: 't-divider',
    tagIcon: 'divider',
    span: 24,
    required: false,
    regList: [],
    changeTag: false
  },
  color: '#dcdfe6',
  content: '',
  style: {
    width: '100%'
  }
}, {
  typeId: 'IMAGE',
  config: {
    label: '图片展示',
    showLabel: false,
    displayType: true,
    labelWidth: null,
    showDefaultValue: false,
    showRequired: false,
    showClearable: false,
    showRegList: false,
    tag: 't-image',
    tagIcon: 'image',
    span: 24,
    required: false,
    regList: [],
    changeTag: true,
    error: 'image'
  },
  style: {
    width: '100%'
  },
  src: '',
  fit: 'contain',
  alt: ''
}, {
  typeId: 'IMAGE_CAROUSEL',
  config: {
    label: '图片轮播',
    showLabel: false,
    displayType: true,
    imageFit: 'contain',
    height: 300,
    labelWidth: null,
    defaultValue: null,
    showDefaultValue: false,
    showRequired: false,
    showClearable: false,
    showRegList: false,
    tag: 't-image-carousel',
    tagIcon: 'image-carousel',
    span: 24,
    required: false,
    regList: [],
    changeTag: true,
    options: [{
      label: '文字',
      image: ''
    }]
  },
  style: {
    width: '100%'
  }
}, {
  typeId: 'DESC_TEXT',
  config: {
    label: '文字描述',
    defaultValue: '',
    displayType: true,
    showDefaultValue: false,
    showRequired: false,
    showClearable: false,
    showRegList: false,
    tag: 'desc-text',
    tagIcon: 'rich-text',
    span: 24,
    required: false,
    regList: [],
    changeTag: false
  },
  content: '描述文字',
  style: {
    width: '100%'
  }
}];

// 高阶组件 【左面板】
var advancedComponents = [{
  typeId: 'SIGN_PAD',
  config: {
    label: '手写签名',
    defaultValue: '',
    showLabel: true,
    showDefaultValue: true,
    showRequired: true,
    showClearable: false,
    showRegList: false,
    tag: 'sign-pad',
    mobileTag: 'mobile-sign-pad',
    tagIcon: 'sign-pad',
    span: 24,
    required: true,
    regList: [],
    changeTag: false
  },
  color: '#000000',
  style: {
    width: '100%'
  },
  action: '/form/file/upload/',
  textConfig: {
    tips: '请在上面区域完成签名 然后点击确"确认"按钮',
    clearBtnText: '清除',
    confirmBtnText: '确认',
    backBtnText: '回撤',
    reSignBtnText: '重签'
  }
}, {
  typeId: 'PROVINCE_CITY',
  config: {
    label: '省市联动',
    labelWidth: null,
    showLabel: true,
    changeTag: false,
    tag: 'province-city',
    // 移动端组件
    mobileTag: 'mobile-province-city',
    tagIcon: 'city',
    defaultValue: undefined,
    required: true,
    span: 24,
    showRegList: false,
    requireDetailAddr: false,
    regList: []
  },
  placeholder: '请选择省市县',
  style: {
    width: '100%'
  }
}, {
  typeId: 'INPUT_MAP',
  config: {
    label: '地理位置',
    labelWidth: null,
    showLabel: true,
    changeTag: false,
    mobileTag: 'input-map',
    tag: 'input-map',
    tagIcon: 'map',
    defaultValue: undefined,
    required: true,
    span: 24,
    showRegList: false,
    regList: []
  },
  placeholder: '请选择位置',
  style: {
    width: '100%'
  },
  longAndLat: false
}, {
  typeId: 'PHONE_VERIFICATION',
  config: {
    label: '手机验证',
    labelWidth: null,
    showLabel: true,
    changeTag: false,
    tag: 'phone-verification',
    // mobileTag: 'mobile-phone-verification',
    tagIcon: 'mobile',
    defaultValue: undefined,
    required: true,
    span: 24,
    showRegList: false,
    regList: []
  },
  placeholder: '请完成',
  style: {
    width: '100%'
  }
}, {
  typeId: 'SUB_FORM',
  config: {
    label: '子表单',
    labelWidth: null,
    showLabel: true,
    changeTag: false,
    tag: 't-sub-form',
    mobileTag: 'mobile-t-sub-form',
    tagIcon: 'sub-form',
    defaultValue: [],
    required: true,
    span: 24,
    showRegList: false,
    regList: []
  },
  childList: [],
  placeholder: '',
  style: {
    width: '100%'
  }
}, {
  typeId: 'MATRIX_INPUT',
  config: {
    label: '矩阵填空',
    labelWidth: null,
    showLabel: true,
    changeTag: false,
    tag: 'matrix-input',
    mobileTag: 'mobile-matrix-input',
    tagIcon: 'Matrix-filling',
    defaultValue: {},
    required: true,
    span: 24,
    showRegList: false,
    regList: []
  },
  table: {
    rows: [{
      label: '矩阵行1',
      id: 1
    }, {
      label: '矩阵行2',
      id: 2
    }, {
      label: '矩阵行3',
      id: 3
    }],
    columns: [{
      label: '填空1',
      id: 1
    }, {
      label: '填空2',
      id: 2
    }, {
      label: '填空3',
      id: 3
    }]
  },
  placeholder: '',
  style: {
    width: '100%'
  }
}, {
  typeId: 'MATRIX_SELECT',
  config: {
    label: '矩阵选择',
    labelWidth: null,
    showLabel: true,
    changeTag: false,
    tag: 'matrix-select',
    mobileTag: 'mobile-matrix-select',
    tagIcon: 'multiple-fill-blank',
    defaultValue: {},
    required: true,
    span: 24,
    showRegList: false,
    regList: []
  },
  table: {
    rows: [{
      label: '矩阵行1',
      id: 1
    }, {
      label: '矩阵行2',
      id: 2
    }, {
      label: '矩阵行3',
      id: 3
    }],
    columns: [{
      label: '选项1',
      id: 1
    }, {
      label: '选项2',
      id: 2
    }, {
      label: '选项3',
      id: 3
    }]
  },
  multiple: false,
  placeholder: '',
  style: {
    width: '100%'
  }
}, {
  typeId: 'MATRIX_SCALE',
  config: {
    label: '矩阵量表',
    labelWidth: null,
    showLabel: true,
    changeTag: false,
    tag: 'matrix-scale',
    mobileTag: 'mobile-matrix-scale',
    tagIcon: 'oil-table-chart',
    defaultValue: {},
    required: true,
    span: 24,
    showRegList: false,
    regList: []
  },
  table: {
    rows: [{
      label: '矩阵行1',
      id: 1
    }, {
      label: '矩阵行2',
      id: 2
    }, {
      label: '矩阵行3',
      id: 3
    }],
    copyWriting: {
      max: '非常不满意',
      min: '非常满意'
    },
    level: 5
  },
  icon: 'tduck-star',
  placeholder: '',
  style: {
    width: '100%'
  }
}, {
  typeId: 'PAGINATION',
  config: {
    label: '分页组件',
    defaultValue: '分页',
    displayType: true,
    showLabel: false,
    showDefaultValue: false,
    showRequired: false,
    showClearable: false,
    showRegList: false,
    tag: 'form-pagination',
    tagIcon: 'page',
    span: 24,
    required: false,
    regList: [],
    changeTag: false
  },
  prev: true,
  currPage: true,
  totalPage: true,
  currPageNum: 1,
  totalPageNum: 1,
  btnSize: 'default',
  textConfig: {
    prevBtnText: '上一页',
    nextBtnText: '下一页'
  },
  style: {
    width: '100%'
  }
}];
var allComponents = [{
  title: '基础组件',
  list: basicComponents
}, {
  title: '进阶组件',
  list: advancedComponents
}];

export {formConf,basicComponents,advancedComponents,allComponents}
