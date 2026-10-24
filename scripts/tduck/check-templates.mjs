import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(path.resolve('tduck-vue3/package.json'))
const {parse,compileTemplate}=require('@vue/compiler-sfc')
const root='tduck-vue3/src/td'
let failures=0
for(const file of fs.readdirSync(root,{recursive:true}).filter(x=>x.endsWith('.vue'))){
 const source=fs.readFileSync(path.join(root,file),'utf8')
 const {descriptor,errors}=parse(source)
 try{const result=descriptor.template&&compileTemplate({source:descriptor.template.content,filename:file,id:file});const errs=[...errors,...(result?.errors||[])];if(errs.length){failures++;console.log(file,errs.map(e=>e.message||e).join('; '))}}catch(e){failures++;console.log(file,e.message)}
}
console.log('Template failures:',failures);process.exitCode=failures?1:0
