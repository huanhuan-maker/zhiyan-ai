<template>
  <div class="echarts" />
</template>

<script>
import * as echarts from 'echarts'
import {markRaw} from 'vue'
import theme from './theme/tduck-echarts-theme.json'
import debounce from 'lodash/debounce'
import { addListener, removeListener } from 'resize-detector'

const INIT_TRIGGERS = ['theme', 'initOptions', 'autoResize']
const REWATCH_TRIGGERS = ['manualUpdate', 'watchShallow']
const THEME_EVENT = 'zhiyan:theme-change'
const DARK_CLASS = 'zy-dark'

// 深色模式只替换图表里的浅色中性色，品牌色与数据驱动色不动。
const NEUTRAL_COLOR_TOKENS = {
  '#fff': '--zy-surface',
  '#ffffff': '--zy-surface',
  '#666': '--zy-text-regular',
  '#333': '--zy-text',
  '#d9d9d9': '--zy-border',
  '#e8e8e8': '--zy-border',
  '#f5f5f5': '--zy-surface-subtle',
  '#e6f7ff': '--zy-primary-soft',
  'rgba(180, 180, 180, 0.1)': '--zy-surface-subtle',
  '#e5e6eb': '--zy-border',
  '#e4e7ec': '--zy-border',
  '#86909c': '--zy-text-secondary',
  '#667085': '--zy-text-secondary'
}

// 令牌读取失败时的深色兜底值，与 workbench.scss 的 .zy-dark 保持一致。
const DARK_FALLBACK = {
  '--zy-surface': '#142235',
  '--zy-surface-subtle': '#111e30',
  '--zy-primary-soft': '#203758',
  '--zy-text': '#edf2f8',
  '--zy-text-regular': '#b8c4d4',
  '--zy-text-secondary': '#8391a5',
  '--zy-border': '#26374b'
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

// 只深拷贝普通对象/数组；函数与 echarts 图形对象（如 LinearGradient）按引用保留。
function cloneChartOption(value) {
  if (Array.isArray(value)) {
    return value.map(cloneChartOption)
  }
  if (!isPlainObject(value)) {
    return value
  }
  const copy = {}
  Object.keys(value).forEach((key) => {
    copy[key] = cloneChartOption(value[key])
  })
  return copy
}

function readToken(style, name, fallback) {
  const value = (style.getPropertyValue(name) || '').trim()
  return value || fallback
}

function applyDarkNeutralColors(value, resolve) {
  if (Array.isArray(value)) {
    return value.map((item) => applyDarkNeutralColors(item, resolve))
  }
  if (isPlainObject(value)) {
    const copy = {}
    Object.keys(value).forEach((key) => {
      copy[key] = applyDarkNeutralColors(value[key], resolve)
    })
    return copy
  }
  if (typeof value === 'string') {
    const token = NEUTRAL_COLOR_TOKENS[value.toLowerCase()]
    return token ? resolve(token) : value
  }
  return value
}

export default {
  props: {
    option: {
      type: Object,
      default: () => {}
    },
    theme: {
      type: [String, Object],
      default: () => {}
    },
    initOptions: {
      type: Object,
      default: () => {}
    },
    group: {
      type: String,
      default: ''
    },
    autoResize: {
      type: Boolean,
      default: true
    },
    watchShallow: {
      type: Boolean,
      default: false
    },
    manualUpdate: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      lastArea: 0
    }
  },
  watch: {
    group(group) {
      this.chart.group = group
    }
  },
  created() {
    this.initOptionsWatcher()
    INIT_TRIGGERS.forEach((prop) => {
      this.$watch(
        prop,
        () => {
          this.refresh()
        },
        { deep: true }
      )
    })
    REWATCH_TRIGGERS.forEach((prop) => {
      this.$watch(prop, () => {
        this.initOptionsWatcher()
        this.refresh()
      })
    })
  },
  mounted() {
    this.__themeHandler = () => this.refresh()
    document.addEventListener(THEME_EVENT, this.__themeHandler)
    if (this.option) {
      echarts.registerTheme('vab-echarts-theme', theme)
      this.init()
    }
  },
  activated() {
    if (this.autoResize) {
      this.chart && this.chart.resize()
    }
  },
  unmounted() {
    if (this.__themeHandler) {
      document.removeEventListener(THEME_EVENT, this.__themeHandler)
      this.__themeHandler = null
    }
    if (this.chart) {
      this.destroy()
    }
  },
  methods: {
    // 浅色保持调用方传入的原始配置；深色把浅色中性色换成本轮工作台的深色令牌。
    getThemedOption(option) {
      const source = option || {}
      if (!document.documentElement.classList.contains(DARK_CLASS)) {
        return source
      }
      const style = getComputedStyle(document.documentElement)
      const darkColor = (token) => readToken(style, token, DARK_FALLBACK[token] || '#8391a5')
      const themed = applyDarkNeutralColors(cloneChartOption(source), darkColor)
      themed.textStyle = Object.assign({ color: darkColor('--zy-text-regular') }, themed.textStyle)
      if (themed.tooltip && typeof themed.tooltip === 'object') {
        themed.tooltip = Object.assign({}, themed.tooltip, {
          backgroundColor: '#1b2a3d',
          borderColor: '#26374b',
          textStyle: Object.assign({}, themed.tooltip.textStyle, { color: '#edf2f8' })
        })
      }
      return themed
    },
    mergeOptions(option, notMerge, lazyUpdate) {
      if (this.manualUpdate) {
        this.manualOptions = option
      }
      if (!this.chart) {
        this.init(option)
      } else {
        this.delegateMethod('setOption', this.getThemedOption(option), notMerge, lazyUpdate)
      }
    },
    appendData(params) {
      this.delegateMethod('appendData', params)
    },
    resize(option) {
      this.delegateMethod('resize', option)
    },
    dispatchAction(payload) {
      this.delegateMethod('dispatchAction', payload)
    },
    convertToPixel(finder, value) {
      return this.delegateMethod('convertToPixel', finder, value)
    },
    convertFromPixel(finder, value) {
      return this.delegateMethod('convertFromPixel', finder, value)
    },
    containPixel(finder, value) {
      return this.delegateMethod('containPixel', finder, value)
    },
    showLoading(type, option) {
      this.delegateMethod('showLoading', type, option)
    },
    hideLoading() {
      this.delegateMethod('hideLoading')
    },
    getDataURL(option) {
      return this.delegateMethod('getDataURL', option)
    },
    getConnectedDataURL(option) {
      return this.delegateMethod('getConnectedDataURL', option)
    },
    clear() {
      this.delegateMethod('clear')
    },
    dispose() {
      this.delegateMethod('dispose')
    },
    delegateMethod(name, ...args) {
      if (!this.chart) {
        this.init()
      }
      return this.chart[name](...args)
    },
    delegateGet(methodName) {
      if (!this.chart) {
        this.init()
      }
      return this.chart[methodName]()
    },
    getArea() {
      return this.$el.offsetWidth * this.$el.offsetHeight
    },
    init(option) {
      if (this.chart) {
        return
      }
      const chart = markRaw(echarts.init(this.$el, this.theme, this.initOptions))
      if (this.group) {
        chart.group = this.group
      }
      chart.setOption(this.getThemedOption(option || this.manualOptions || this.option || {}), true)
      Object.keys(this.$attrs).filter(key=>key.startsWith("on")).forEach((key) => {
const event=key.slice(2).toLowerCase(); const handler = this.$attrs[key]
        if (event.indexOf('zr:') === 0) {
          chart.getZr().on(event.slice(3), handler)
        } else {
          chart.on(event, handler)
        }
      })
      if (this.autoResize) {
        this.lastArea = this.getArea()
        this.__resizeHandler = debounce(
          () => {
            if (this.lastArea === 0) {
              this.mergeOptions({}, true)
              this.resize()
              this.mergeOptions(this.option || this.manualOptions || {}, true)
            } else {
              this.resize()
            }
            this.lastArea = this.getArea()
          },
          100,
          { leading: true }
        )
        addListener(this.$el, this.__resizeHandler)
      }
      Object.defineProperties(this, {
        width: {
          configurable: true,
          get: () => {
            return this.delegateGet('getWidth')
          }
        },
        height: {
          configurable: true,
          get: () => {
            return this.delegateGet('getHeight')
          }
        },
        isDisposed: {
          configurable: true,
          get: () => {
            return !!this.delegateGet('isDisposed')
          }
        },
        computedOptions: {
          configurable: true,
          get: () => {
            return this.delegateGet('getOption')
          }
        }
      })
      this.chart = chart
    },
    initOptionsWatcher() {
      if (this.__unwatchOptions) {
        this.__unwatchOptions()
        this.__unwatchOptions = null
      }
      if (!this.manualUpdate) {
        this.__unwatchOptions = this.$watch(
          'option',
          (val, oldVal) => {
            if (!this.chart && val) {
              this.init()
            } else {
              this.chart.setOption(this.getThemedOption(val), val !== oldVal)
            }
          },
          { deep: !this.watchShallow }
        )
      }
    },
    destroy() {
      if (this.autoResize) {
        removeListener(this.$el, this.__resizeHandler)
      }
      this.dispose()
      this.chart = null
    },
    refresh() {
      if (this.chart) {
        this.destroy()
        this.init()
      }
    }
  },
  connect(group) {
    if (typeof group !== 'string') {
      group = group.map((chart) => chart.chart)
    }
    echarts.connect(group)
  },
  disconnect(group) {
    echarts.disConnect(group)
  },
  getMap(mapName) {
    return echarts.getMap(mapName)
  },
  registerMap(mapName, geoJSON, specialAreas) {
    echarts.registerMap(mapName, geoJSON, specialAreas)
  },
  graphic: echarts.graphic
}
</script>
<style>
.echarts {
  width: 600px;
  height: 400px;
}
</style>
