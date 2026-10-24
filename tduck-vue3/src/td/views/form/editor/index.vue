<template>
  <FormDesign :question-mode="true" />
</template>
<script>
import TduckForm, { FormDesign } from '@/generator'
import '@/generator/style.css'
import mixin from '../TduckFormMixin.js'

export default {
  name: 'FormEditor',
  components: {
    FormDesign
  },
  mixins: [mixin],
  data() {
    return {}
  },
  computed: {},
  methods: {}
}
</script>

<style lang="scss"></style>
