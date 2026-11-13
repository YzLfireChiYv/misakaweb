/** Maintenance relations only: no browser execution or user configuration access. */
import { chainFileHits } from './catalog-chains.mjs'
const unique = values => [...new Set(values.filter(Boolean))].sort()
const assemblyBoundaries = new Set([
    'src/modules/index.ts', 'src/modules/rules/index.ts', 'src/modules/filters/index.ts',
    'src/modules/configuration/registry.ts', 'src/main.ts', 'src/App.vue',
])

const labelPages = pages => unique(pages.map(page => page === '*' ? 'all' : page))

const objectFor = (key, panels, pack) => {
    if (key.startsWith('biliweb-sync-') || key.startsWith('config-') || key === 'menu-configuration') return 'configuration'
    if (key.includes('shortcut') || key === 'menu-side-btn') return 'shortcut'
    if (panels.includes('comment-filter')) return 'comment'
    if (panels.includes('dynamic-filter')) return 'dynamic'
    if (panels.includes('article-filter')) return 'article'
    if (panels.includes('video-filter')) return 'video-card'
    if (/share|copy-(space|video)-url/.test(key)) return 'share'
    if (/subtitle/.test(key)) return 'subtitle'
    if (/danmaku|(?:^|-)dm-/.test(key)) return 'danmaku'
    if (/theme-dark|dark-mode/.test(key)) return 'theme'
    if (/header.*search|nav-search|hide-search/.test(key)) return 'search'
    if (/header|(?:^|-)nav-/.test(key)) return 'header'
    if (/player|fullscreen|webscreen|widescreen|mini-mode|^misakaweb-gesture/.test(key)) return 'player'
    if (/dyn-|dynamic-page/.test(key)) return 'dynamic'
    if (/comment|reply/.test(key)) return 'comment'
    if (/card|rcmd-list|recommend-list/.test(key)) return 'video-card'
    if (pack === 'layout') return 'layout'
    return null
}

const originFor = files => {
    const kinds = unique(files.map(file => {
        if (file.provenance === 'own-confirmed') return 'own'
        if (file.provenance === 'derived-from-fixed-baseline') return 'derived'
        if (file.upstream && file.status === 'unchanged') return 'upstream-match'
        if (file.upstream && file.status === 'diverged') return 'upstream-modified'
        return 'unknown'
    }))
    const owners = unique(files.map(file=>file.provenance==='own-confirmed'?'own':file.upstream?.source))
    return owners.length > 1 ? unique([...kinds, 'mixed']) : kinds.length ? kinds : ['unknown']
}

const locationsFor = (indexed, declarations) => {
    const out = new Map()
    for (const row of declarations) out.set(`${row.path}:${row.line}`, {path:row.path,line:row.line,relation:'declaration'})
    for (const row of indexed?.occurrences ?? []) {
        const id = `${row.path}:${row.line??''}`
        if (!out.has(id)) out.set(id, {path:row.path,line:row.line,relation:row.relation??'source-reference'})
    }
    return [...out.values()].sort((a,b)=>a.path.localeCompare(b.path)||(a.line??0)-(b.line??0))
}

export const buildRelations = ({ index, controls, configurations, declarations, features, actions, controlMap, taxonomy, decisions }) => {
    const indexed = new Map(index.settings.map(row=>[row.id,row]))
    const definitions = new Map(declarations.map(row=>[row.id,row]))
    const byControlId = new Map(controlMap.settings.map(row=>[row.id,row]))
    const files = new Map(index.files.map(row=>[row.path,row]))
    const byId = new Map(controls.map(row=>[row.id,row]))
    const featureIds = new Set(features.map(row=>row.id))
    const scopeDecisions = new Map()
    for(const policy of decisions.capabilities??[]) {
        if(policy.featureId&&!featureIds.has(policy.featureId))throw new Error(`产品决定关联的功能不存在：${policy.featureId}`)
        for(const key of policy.keys) {
            if(scopeDecisions.has(key))throw new Error(`重复的产品范围决定：${key}`)
            scopeDecisions.set(key,policy)
        }
    }
    const knownKeys = new Set([...controls,...actions].map(row=>row.key))
    for (const key of [...Object.keys(taxonomy.overrides),...scopeDecisions.keys()])
        if(!knownKeys.has(key))throw new Error(`目录中未找到标签或产品决定对应的控件：${key}`)
    for(const [id,record]of Object.entries(taxonomy.featureFiles??{})) {
        if(!featureIds.has(id))throw new Error(`未知功能：${id}`)
        for(const file of record.paths)if(!files.has(file))throw new Error(`功能关联的文件不存在：${id} ${file}`)
    }

    const makeTags = (row, {pages,panels,category,pack,implementation}) => {
        const override = taxonomy.overrides[row.key]
        const policy = scopeDecisions.get(row.key)
        const data = row.key.startsWith('biliweb-sync-')||row.key.startsWith('config-')||row.key==='menu-configuration'
        const purpose = data ? ['data'] : category==='filtering' ? ['cleaning','filtering'] : [category??'support']
        const object = objectFor(row.key,panels,pack)
        const directFiles = row.locations.filter(item=>['declaration','storage-binding','reviewed-component'].includes(item.relation)||
            (/\.(css|scss)$/.test(item.path)&&item.line!=null)).map(item=>files.get(item.path)).filter(Boolean)
        const sourceFiles = directFiles.length ? directFiles : row.locations.filter(item=>item.line!=null).map(item=>files.get(item.path)).filter(Boolean)
        row.tags = {
            purpose, page:labelPages(pages).length?labelPages(pages):['unknown'],
            object:override?.object??[object??(category==='cleaning'?'page-element':'unknown')],
            role:override?.role??[data?'support':category==='filtering'?'decide':category==='cleaning'?'apply':category==='optimization'?'extra':'support'],
            origin:originFor(sourceFiles),product:[policy?.status??(purpose.includes('cleaning')?'retain':'pending')],
            implementation:[implementation],
        }
        if(override)row.tagEvidence=override.evidence
        if(policy)row.productDecision={status:policy.status,reason:policy.reason,evidence:policy.evidence}
    }
    for(const control of controls) {
        const observed = byControlId.get(control.id)
        control.locations=locationsFor(indexed.get(control.id),control.declarationIds.map(id=>definitions.get(id)).filter(Boolean))
        for(const id of control.featureIds)for(const file of taxonomy.featureFiles?.[id]?.paths??[])
            control.locations.push({path:file,line:null,relation:'reviewed-component',evidence:taxonomy.featureFiles[id].evidence})
        makeTags(control, {pages:observed.pages??[],panels:observed.panels??[],category:control.category,pack:control.pack,
            implementation:control.retired?'historical':control.featureIds.includes('F-MISAKA-TOUCH')?'prototype':control.locations.some(row=>row.line!=null)?'located':'unknown'})
    }
    for(const action of actions) {
        action.locations=locationsFor(indexed.get(action.id),[])
        const policy=scopeDecisions.get(action.key)
        action.featureIds=policy?.featureId?[policy.featureId]:[]
        if(action.featureIds.length)action.featureMappingStatus='recorded-policy'
        makeTags(action,{pages:action.pages??[],panels:action.panel?[action.panel]:[],category:policy?.featureId==='F-COM-DARK'?'optimization':'support',
            implementation:action.retired?'historical':action.locations.some(row=>row.line!=null)?'located':'unknown'})
    }
    const dimensions=Object.keys(taxonomy.dimensions)
    const aggregate = (rows, fallback={}) => Object.fromEntries(dimensions.map(name=>{
        const values=unique(rows.flatMap(row=>row.tags[name]))
        return [name,values.length?values:[fallback[name]??(name==='product'?'pending':'unknown')]]
    }))
    for(const configuration of configurations) {
        configuration.tags=aggregate(configuration.controlIds.map(id=>byId.get(id)),{purpose:'data',object:'configuration',role:'support',implementation:'located'})
        if(configuration.tags.product.every(value=>value==='not-offered'))configuration.productDefaultStatus='not-applicable'
    }
    for(const feature of features) {
        feature.actionIds=actions.filter(row=>row.featureIds.includes(feature.id)).map(row=>row.id)
        feature.tags=aggregate([...feature.controlIds.map(id=>byId.get(id)),...actions.filter(row=>feature.actionIds.includes(row.id))],{implementation:'historical'})
    }
    for(const row of [...controls,...configurations,...features,...actions])for(const [dimension,values]of Object.entries(row.tags))
        for(const value of values)if(!Object.hasOwn(taxonomy.dimensions[dimension].values,value))
            throw new Error(`未登记的标签：${row.id} ${dimension}=${value}`)
    return {
        tagVocabulary:taxonomy.dimensions,
        sourceFiles:index.files.map(row=>({path:row.path,status:row.status,provenance:row.provenance,upstream:row.upstream,
            localNotes:row.localNotes??[],staticImports:row.imports??[]})),
    }
}

export const filterCatalog = (catalog, clauses, {limit=20,offset=0}={}) => {
    const filters=clauses.map(clause=>{
        const [dimension,value,...extra]=clause.split('=')
        if(extra.length||!Object.hasOwn(catalog.tagVocabulary,dimension)||!Object.hasOwn(catalog.tagVocabulary[dimension].values,value))
            throw new Error(`无效标签条件：${clause}；用 --tags 查看词典`)
        return [dimension,value]
    })
    const matched=[...catalog.controls,...catalog.actions].filter(row=>filters.every(([dimension,value])=>
        row.tags[dimension].includes(value)||(dimension==='page'&&value!=='unknown'&&row.tags.page.includes('all'))))
    return {filters:clauses,total:matched.length,offset,limit,entries:matched.slice(offset,offset+limit).map(row=>({
        id:row.id,key:row.key,name:row.names?.[0]??row.name,configurationId:row.configurationId??null,
        featureIds:row.featureIds??[],tags:row.tags,
    }))}
}

/** Static reverse lookup. Return the shortest import trail for each matched entry. */
export const upstreamImpact = (catalog, queries, {limit=20,offset=0}={}) => {
    const entries = catalog.sourceFiles
    const byPath = new Map(entries.map(row=>[row.path,row]))
    const sourceIds = new Set(catalog.sources.map(row=>row.id))
    const targets = new Set(), changes=[]
    for(const query of unique(queries)) {
        const colon=query.indexOf(':')
        const source=query.slice(0,colon), file=query.slice(colon+1).replaceAll('\\','/')
        if(colon<1||!sourceIds.has(source)||!file||file.startsWith('/')||file.split('/').includes('..'))
            throw new Error(`无效上游路径：${query}；格式为 来源ID:仓库相对路径`)
        const matched=entries.filter(row=>row.upstream?.source===source&&row.upstream.path===file)
        const recorded=catalog.coverage?.source.id===source?catalog.coverage.files.find(row=>row.path===file):undefined
        for(const row of matched)targets.add(row.path)
        changes.push({source,path:file,status:matched.length?'mapped':recorded?'registered-only':'unmapped',localFiles:matched,
            ...(recorded?{coverage:recorded.status,kind:recorded.kind,localPath:recorded.localPath}:{})})
    }
    const reverse=new Map()
    for(const row of entries)for(const imported of row.staticImports) {
        if(!reverse.has(imported))reverse.set(imported,[])
        reverse.get(imported).push(row.path)
    }
    const trails=new Map([...targets].sort().map(file=>[file,[file]]))
    const queue=[...trails.keys()]
    for(let i=0;i<queue.length;i++)for(const dependent of reverse.get(queue[i])??[]) {
        if(trails.has(dependent)||assemblyBoundaries.has(queue[i]))continue
        trails.set(dependent,[dependent,...trails.get(queue[i])]);queue.push(dependent)
    }
    const configurations=new Map(catalog.configurations.map(row=>[row.id,row]))
    const standalone=catalog.configurations.filter(row=>!row.controlIds.length).map(row=>({...row,configurationId:row.id,locations:[]}))
    const observedActions=new Map((catalog.coverage?.actions??[]).map(row=>[row.id,row.refs]))
    const observedDeclarations=new Map((catalog.coverage?.declarations??[]).map(row=>[row.id,row]))
    const hits=[...catalog.controls,...catalog.actions,...standalone].flatMap(row=>{
        const config=configurations.get(row.configurationId)
        const paths=unique([...row.locations.filter(item=>item.line!=null||item.relation==='reviewed-component').map(item=>item.path),
            ...(observedActions.get(row.id)??[]).map(ref=>ref.path),
            ...(row.declarationIds??[]).flatMap(id=>{const record=observedDeclarations.get(id);return record?[...record.refs,...record.css.filter(ref=>ref.line!=null)].map(ref=>ref.path):[]}),
            ...(config?.readFallbacks??[]).map(site=>site.path),...(config?.configurationDefaults??[]).map(site=>site.path),
            config?.ruleAbsentDefault?.path])
        const matches=paths.filter(file=>trails.has(file)&&(targets.has(file)||!assemblyBoundaries.has(file)))
            .map(file=>({path:file,trail:trails.get(file)}))
            .sort((a,b)=>a.trail.length-b.trail.length||a.path.localeCompare(b.path))
        if(!matches.length)return []
        const best=matches[0]
        return [{id:row.id,key:row.key,name:row.names?.[0]??row.name,featureIds:row.featureIds??[],
            configurationId:row.configurationId??null,capabilityEditions:row.capabilityEditions??[],
            relation:best.trail.length===1?'direct':'static-import',path:best.path,trail:best.trail,
            localNotes:unique(best.trail.flatMap(file=>byPath.get(file)?.localNotes??[]))}]
    }).sort((a,b)=>a.trail.length-b.trail.length||a.id.localeCompare(b.id))
    const boundaries=[...trails.keys()].filter(file=>assemblyBoundaries.has(file)).sort()
        .map(file=>({path:file,changed:targets.has(file),trail:trails.get(file),localNotes:byPath.get(file)?.localNotes??[]}))
    return {changes,boundaries,chainHits:chainFileHits(catalog,targets),total:hits.length,direct:hits.filter(row=>row.relation==='direct').length,
        featureIds:unique(hits.flatMap(row=>row.featureIds)),offset,limit,hits:hits.slice(offset,offset+limit)}
}
