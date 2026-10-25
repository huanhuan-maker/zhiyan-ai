// 缺陷1回归：明文凭证扫描（无需后端）
// 契约：所有被 Git 跟踪的文本文件中不得出现本地真实凭据
// （管理员账号/密码、数据库口令、长 Bearer 令牌）；凭据只允许存放在
// .local/tduck-credentials.json（已被 .gitignore 排除）。
// 结果写入 evidence/tduck-full/credential-scan.json（仅文件/行号/规则名，不含凭据值）。
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'

const results=[],errors=[]
function check(name,ok,detail=''){results.push({name,ok});console.log((ok?'[ok] ':'[FAIL] ')+name+(detail?' | '+detail:''));if(!ok)errors.push(name)}

const credPath='.local/tduck-credentials.json'
if(!fs.existsSync(credPath)){console.error('缺少 '+credPath+'（本地凭据清单，不入库），无法执行扫描');process.exit(2)}
const creds=JSON.parse(fs.readFileSync(credPath,'utf8').replace(/^\uFEFF/,''))

// 1) .local/ 必须被 .gitignore 排除，凭据清单本身不得被跟踪
const gi=fs.readFileSync('.gitignore','utf8')
check('.gitignore 排除 .local/（凭据清单所在目录）', /^\s*\.local\/?\s*$/m.test(gi))

const files=execFileSync('git',['ls-files'],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean)
check('凭据清单未被 Git 跟踪', !files.some(p=>p.replace(/\\/g,'/').startsWith('.local/')))

// 2) 跟踪的文本文件不得包含真实凭据（按上下文匹配，避免弱口令黑名单/十六进制表等误报）
const TEXT_EXT=/\.(md|json|mjs|js|cjs|ts|ps1|psm1|py|sql|patch|diff|yml|yaml|txt|java|vue|html?|env|example|gitignore|xml|properties|bat|cmd|sh|csv)$/i
const textFiles=files.filter(p=>TEXT_EXT.test(p))
const rules=[
  {id:'admin-account',needle:creds.adminEmail},
  {id:'admin-password',needle:creds.adminPassword},
  {id:'mysql-cli-flag',re:new RegExp('-p'+creds.mysqlRootPassword+'(?![0-9A-Za-z])')},
  {id:'mysql-config',re:new RegExp('password\\s*[=:]\\s*["\']?'+creds.mysqlRootPassword+'\\b','i')},
  {id:'bearer-token',re:/Bearer\s+[A-Za-z0-9._-]{20,}/},
]
const hits=[]
for(const p of textFiles){
  let text
  try{text=fs.readFileSync(p,'utf8')}catch{continue}
  const lines=text.split(/\r?\n/)
  lines.forEach((line,i)=>{for(const r of rules){
    if((r.needle&&line.includes(r.needle))||(r.re&&r.re.test(line)))hits.push({file:p,line:i+1,rule:r.id})
  }})
}
check('跟踪文件不含管理员账号/密码/数据库口令/Bearer令牌（扫描'+textFiles.length+'个文本文件）',hits.length===0,hits.slice(0,8).map(h=>h.file+':'+h.line+'('+h.rule+')').join(', ')+(hits.length>8?' 等'+hits.length+'处':''))

fs.writeFileSync('evidence/tduck-full/credential-scan.json',JSON.stringify({date:new Date().toISOString(),scannedFiles:textFiles.length,hits,results},null,1)+'\n')
console.log(`\n凭据扫描: ${results.length}项检查, 失败 ${errors.length}`)
if(errors.length){console.log('FAILED: '+errors.join(' ; '));process.exit(1)}
