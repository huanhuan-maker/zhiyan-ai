import FormDesign from './FormDesign.vue'
import GenerateForm from './GenerateForm.vue'
import BizProjectForm from './BizProjectForm.vue'
import {allComponents} from './config'
import * as convert from './schema'
const constant={BASE_URL:'BASE_URL',ACCESS_TOKEN:'ACCESS_TOKEN'}
const GenerateConfig={allComponents}
export {FormDesign,GenerateForm,BizProjectForm,GenerateConfig,convert,constant}
export default {FormDesign,GenerateForm,BizProjectForm,GenerateConfig,convert,constant}
