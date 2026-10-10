// Compile shared source into complete userscripts. No user storage or upstream checkout.
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

export const productRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => JSON.parse(fs.readFileSync(path.join(productRoot, file), 'utf8'))
export const packRegistry = read('config/optimization-packs.json')
export const profiles = read('config/build-profiles.json').profiles
const catalogText = fs.readFileSync(path.join(productRoot,'src/feedback/review-catalog.generated.ts'),'utf8')
export const catalog = JSON.parse(catalogText.match(/export const reviewCatalog: ReviewEntry\[\] = (\[[\s\S]*\])\s*$/)[1])
const owners = new Map()
for (const pack of packRegistry.packs) for (const key of pack.setting_keys) {
    if (owners.has(key)) throw new Error(`duplicate pack ownership: ${key}`)
    owners.set(key, pack.id)
}
if (catalog.filter(row=>row.category==='optimization').some(row=>owners.get(row.key)!==row.pack) ||
    owners.size!==catalog.filter(row=>row.category==='optimization').length) throw new Error('optimization catalog/pack registry mismatch')
const coreKeys = catalog.filter(row=>row.category!=='optimization').map(row=>row.key)
const knownKeys = new Set(catalog.map(row=>row.key))
for (const profile of profiles) {
    if (!/^[a-z][a-z0-9-]*$/.test(profile.id) || new Set(profile.packs).size !== profile.packs.length ||
        profile.packs.some(id=>!packRegistry.packs.some(p=>p.id===id&&p.setting_keys.length))) throw new Error(`invalid or unimplemented profile: ${profile.id}`)
}
if (new Set(profiles.map(p=>p.id)).size!==profiles.length) throw new Error('duplicate profiles')
export const profileFor = id => {
    const profile = profiles.find(p=>p.id===id)
    if (!profile) throw new Error(`unknown build profile: ${id}`)
    return profile
}
export const excludedKeys = profile => new Set([...owners].filter(([,pack])=>!profile.packs.includes(pack)).map(([key])=>key))
export const classificationFor = profile => {
    const excluded = profile ? excludedKeys(profile) : new Set()
    return Object.fromEntries(catalog.filter(row=>row.id.startsWith('S')&&!excluded.has(row.key))
        .map(row=>[row.key,{category:row.category,...(row.pack ? {pack:row.pack,packLabel:row.packLabel} : {})}]))
}
const literal = node => node && (ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined
const property = (node, name) => ts.isObjectLiteralExpression(node)
    ? node.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText().replace(/['"]/g,'')===name)?.initializer : undefined

// Removing an array element before evaluation removes its attrName IIFE and function bodies.
export function pruneSource(source, file, profile) {
    const excluded = excludedKeys(profile)
    const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
    const shouldRemove = node => {
        const id=literal(property(node,'id'))
        if(id && file.replaceAll('\\','/').includes('/modules/rules/') &&
            ['switch','number','string','list','editor','webdav'].includes(literal(property(node,'type'))) && !knownKeys.has(id)) {
            throw new Error(`unclassified page capability: ${file}/${id}; update catalog and pack registry first`)
        }
        if(id && excluded.has(id)) return true
        if(excluded.has(literal(property(node,'key')))) return true
        const name=literal(property(node,'name'))
        return !profile.packs.includes('link-tools') && ['复制主页链接','复制视频链接'].includes(name)
    }
    const result=ts.transform(sf,[ctx=>root=>{
        const visit=node=>{
            if(ts.isArrayLiteralExpression(node)) return ctx.factory.updateArrayLiteralExpression(node,node.elements.filter(n=>!shouldRemove(n)).map(n=>ts.visitNode(n,visit)))
            if(ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)&&node.expression.arguments.some(shouldRemove)) {
                const call=node.expression
                if(ts.isPropertyAccessExpression(call.expression)&&call.expression.name.text==='push'&&call.arguments.length===1) return ctx.factory.createEmptyStatement()
                throw new Error(`unsupported optional action placement: ${file}`)
            }
            return ts.visitEachChild(node,visit,ctx)
        };return ts.visitNode(root,visit)
    }])
    try { return ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(result.transformed[0]) }
    finally { result.dispose() }
}

// Split selector lists at the top level, preserving commas inside :is/:not/:has.
export function selectorBranches(selector) {
    const result=[];let start=0,round=0,square=0,quote=''
    for(let i=0;i<selector.length;i++) {
        const c=selector[i]
        if(c==='\\') {i++;continue}
        if(quote) {if(c===quote)quote='';continue}
        if(c==='"'||c==="'") {quote=c;continue}
        if(c==='(')round++;else if(c===')')round--;else if(c==='[')square++;else if(c===']')square--
        else if(c===','&&!round&&!square) {result.push(selector.slice(start,i).trim());start=i+1}
    }
    result.push(selector.slice(start).trim());return result
}
// Attribute aliases are page-specific attrName values (e.g. border-radius-video),
// or secondary flags from that rule (common-theme-dark-page).
const attributeExcluded = (attr, excluded) => [...excluded].some(key=>attr===key||attr.startsWith(key+'-'))
export function pruneSelector(selector, excluded) {
    return selectorBranches(selector).map(branch=>{
        // An impossible positive flag inside :not is an always-true guard;
        // retain the enclosing cleaning rule instead of deleting it.
        branch=branch.replace(/:not\(\s*\[([\w-]+)(?:[^\]]*)\]\s*\)/g,(all,attr)=>attributeExcluded(attr,excluded)?'':all)
        const attrs=[...branch.matchAll(/\[([\w-]+)(?=[\s~|^$*!=\]])/g)].map(m=>m[1])
        return attrs.some(attr=>attributeExcluded(attr,excluded)) ? '' : branch
    }).filter(Boolean).join(', ')
}
export const cssPruningPlugin = profile => {
    const excluded=excludedKeys(profile)
    return {postcssPlugin:'misakaweb-pack-css',Once(root){
        root.walkRules(rule=>{
            const selector=pruneSelector(rule.selector,excluded)
            if(!selector)rule.remove();else rule.selector=selector
        })
        if(!profile.packs.includes('text-style'))root.walkAtRules('font-face',rule=>{
            if(rule.nodes?.some(n=>n.prop==='font-family'&&n.value.includes('HarmonyOS_')))rule.remove()
        })
        // Pruning children may leave @media / @supports empty.
        root.walkAtRules(rule=>{if(rule.nodes&&!rule.nodes.length)rule.remove()})
    }}
}

const themePath=path.join(productRoot,'src/modules/rules/common/groups/theme.ts').replaceAll('\\','/')
export const packSourcePlugin = profile => ({
    name:'misakaweb-pack-source',enforce:'pre',
    transform(code,id) {
        const file=id.split('?')[0].replaceAll('\\','/')
        if(!file.startsWith(productRoot.replaceAll('\\','/')+'/src/')) return
        if(file===themePath&&!profile.packs.includes('appearance'))return {code:"import { ref } from 'vue'; export const isDarkMode=ref(false); export const commonThemeItems=[]; export const toggleDarkMode=()=>{};",map:null}
        if(file.endsWith('/modules/touch/index.ts')&&!profile.packs.includes('touch-controls'))return {code:'export const touchItems=[];',map:null}
        if(file.endsWith('.ts')&&(file.includes('/modules/rules/')||file.includes('/modules/filters/')||file.endsWith('/feedback/context-actions.ts')))return {code:pruneSource(code,file,profile),map:null}
    }
})

// Independent emitted-bundle audit: verify every rule definition count against
// the complete development bundle, including repeated IDs across page groups.
export function itemDefinitions(source) {
    const sf=ts.createSourceFile('bundle.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),items=new Map()
    const visit=node=>{
        if(ts.isObjectLiteralExpression(node)) {
            const id=literal(property(node,'id')),type=literal(property(node,'type'))
            if(id&&['switch','number','string','list','editor','webdav'].includes(type))items.set(id,(items.get(id)||0)+1)
        }
        ts.forEachChild(node,visit)
    };visit(sf);return items
}
export function auditBundle(source,full,profile) {
    const excluded=excludedKeys(profile),baseline=itemDefinitions(full),actual=itemDefinitions(source)
    for(const [key,count] of baseline) {
        if(excluded.has(key)) {if(actual.has(key))throw new Error(`excluded item shipped: ${profile.id}/${key}`)}
        else if(actual.get(key)!==count)throw new Error(`retained item lost: ${profile.id}/${key}`)
    }
    if(!profile.packs.includes('link-tools')&&/复制主页链接|复制视频链接/.test(source))throw new Error('excluded context action shipped')
    if(!profile.packs.includes('appearance')&&source.includes('labStyleLock'))throw new Error('excluded theme runtime shipped')
    if(!profile.packs.includes('playback')&&source.includes('DOMMouseScroll'))throw new Error('excluded player wheel hook shipped')
    if(!profile.packs.includes('text-style')&&source.includes('@font-face'))throw new Error('excluded font resource shipped')
    if(source.includes('product-retention-feedback')||source.includes('原逐项分类'))throw new Error('development review shipped in normal profile')
    // CSS declarations are JS strings in the emitted script. Attribute names
    // remain plain text; reject active positive flags of excluded capabilities.
    for(const key of excluded)if(new RegExp('\\['+key+'(?:-|[\\s=\\]~|^$*!])').test(source))throw new Error(`excluded style shipped: ${profile.id}/${key}`)
    return {cleaningKeys:catalog.filter(row=>row.category==='cleaning').length,supportKeys:coreKeys.length-catalog.filter(row=>row.category==='cleaning').length,optimizationKeys:[...owners].filter(([,pack])=>profile.packs.includes(pack)).length,
        retainedLiteralDefinitions:[...actual.values()].reduce((a,b)=>a+b,0),excludedKeys:[...excluded].sort()}
}
