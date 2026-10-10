import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { productRoot, profiles, profileFor, auditBundle } from './pack-build.mjs'

const release=JSON.parse(fs.readFileSync(path.join(productRoot,'config/release.json'),'utf8'))
const full=fs.readFileSync(path.join(productRoot,'../misakaweb-feedback-test.user.js'),'utf8')
if(!full.match(new RegExp('@version\\s+'+release.development.version.replaceAll('.','\\.')+'\\s')))throw new Error('Build current feedback bundle first; full audit baseline is stale')
const staging=path.join(productRoot,'node_modules/.tmp/variant-candidates')
const destination=path.join(productRoot,'../variants')
const args=process.argv.slice(2).filter(arg=>arg!=='--')
if(args.length && (args.length!==2 || args[0]!=='--profile'))throw new Error('Usage: build-variants.mjs [--profile ID]')
const selected=args.length ? [profileFor(args[1])] : profiles
const previousPath=path.join(destination,'manifest.json')
const previous=args.length&&fs.existsSync(previousPath) ? JSON.parse(fs.readFileSync(previousPath,'utf8')) : null
fs.mkdirSync(staging,{recursive:true})
const manifest={schemaVersion:1,version:release.development.version,identity:{name:'MisakaWeb',namespace:'https://github.com/YzLfireChiYv/misakaweb'},installation:'Install one complete variant, replacing the existing script, then reload pages. Settings keys unchanged; excluded values preserved.',profiles:[]}
const candidates=[]
for(const profile of selected) {
    const run=spawnSync(process.platform==='win32'?'pnpm.cmd':'pnpm',['exec','vite','build','--mode','production'],{
        cwd:productRoot,env:{...process.env,MISAKA_PROFILE:profile.id},stdio:'inherit',shell:process.platform==='win32',windowsHide:true})
    if(run.error||run.status!==0)throw new Error(`profile build failed: ${profile.id}: ${run.error??run.status}`)
    const name=`misakaweb-${profile.id}.user.js`,buffer=fs.readFileSync(path.join(productRoot,'dist',name)),source=buffer.toString('utf8')
    const url=`https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/${name}`
    for(const field of ['downloadURL','updateURL'])if(!source.includes(`// @${field}`)||!source.match(new RegExp(`^// @${field}\\s+${url.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*$`,'m')))throw new Error('variant update metadata mismatch')
    const audit=auditBundle(source,full,profile)
    fs.writeFileSync(path.join(staging,name),buffer)
    candidates.push({...profile,version:release.development.version,artifact:`products/experience/variants/${name}`,updateURL:url,downloadURL:url,sha256:createHash('sha256').update(buffer).digest('hex'),bytes:buffer.length,audit})
}
// Publish local candidates only after every build/audit succeeded. CI publishes
// the whole set in one Git commit; compilation failures leave previous variants intact.
fs.mkdirSync(destination,{recursive:true})
for(const profile of candidates)fs.copyFileSync(path.join(staging,path.basename(profile.artifact)),path.join(destination,path.basename(profile.artifact)))
manifest.profiles=profiles.flatMap(profile=>{
    const updated=candidates.find(item=>item.id===profile.id)
    const retained=previous?.profiles.find(item=>item.id===profile.id)
    return updated ? [updated] : retained ? [{...retained,version:retained.version??previous.version}] : []
})
fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
console.log(`Built and audited ${candidates.length} complete variants; retained other experimental versions`)
