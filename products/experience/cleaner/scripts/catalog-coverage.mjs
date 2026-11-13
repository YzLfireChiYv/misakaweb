import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const uniq = values => [...new Set(values.filter(Boolean))].sort()
const siteFilterIds = ['video-filter','comment-filter','dynamic-filter','article-filter']
const sourceFamilies = (seed,p) => seed.sourceFamilies.find(row=>p.startsWith(row.prefix))??
    {kind:'repository-support',detail:'构建配置、工具、资源或项目资料；单列其仓库作用。'}

const styleRules = (files,reader) => {
    const rows=new Map()
    for(const file of files.filter(row=>/\.(scss|css)$/.test(row.path))) {
        const text=reader.file(file.path).text
        // Discard comments and declaration bodies; only consider brackets in selector headers.
        const cleaned=text.replace(/\/\*[\s\S]*?\*\//g,part=>part.replace(/[^\r\n]/g,' '))
            .replace(/^\s*\/\/[^\r\n]*/gm,part=>part.replace(/[^\r\n]/g,' '))
        const head=/(?:^|(?<=[{};]))([^{};]+)\{/g
        for(const match of cleaned.matchAll(head)) {
            const selector=match[1].trim()
            if(!selector||selector.startsWith('@'))continue
            const line=cleaned.slice(0,match.index+match[0].indexOf(match[1])+match[1].search(/\S/)).split('\n').length
            for(const hit of selector.matchAll(/\[([a-zA-Z][\w-]*)(?=\s*(?:\]|[~|^$*]?=))/g)) {
                const key=hit[1], row={path:file.path,line,selector:selector.replace(/\s+/g,' ')}
                if(!rows.has(key))rows.set(key,[])
                rows.get(key).push(row)
            }
        }
    }
    return rows
}

const contextMenus = (files,reader) => {
    const templatePath='src/feedback/context-actions.ts', {sf,variables}=reader.file(templatePath)
    const rules=variables.get('RULES')
    if(!rules||!ts.isArrayLiteralExpression(rules))throw new Error('无法读取右键动作模板')
    const templates=rules.elements.map(row=>Object.fromEntries(row.properties.filter(ts.isPropertyAssignment).map(prop=>[prop.name.getText(sf),prop.initializer.text])))
    const findLinkTemplates = node => {
        if (ts.isIfStatement(node) && ts.isBinaryExpression(node.expression) &&
            node.expression.left.getText(sf) === 'name' && ts.isStringLiteral(node.expression.right) &&
            ts.isReturnStatement(node.thenStatement) && ts.isStringLiteral(node.thenStatement.expression))
            templates.push({exact:node.expression.right.text,key:node.thenStatement.expression.text})
        ts.forEachChild(node,findLinkTemplates)
    }
    findLinkTemplates(sf)
    const matches=[]
    for(const file of files.filter(row=>row.path.includes('/filters/variety/')&&row.path.endsWith('.ts'))) {
        const {sf}=reader.file(file.path)
        const walk=node=>{
            if(ts.isObjectLiteralExpression(node)) {
                const props=new Map(node.properties.filter(ts.isPropertyAssignment).map(prop=>[prop.name.getText(sf),prop.initializer]))
                const name=props.get('name'), fn=props.get('fn')
                const label=name&&(ts.isStringLiteral(name)||ts.isNoSubstitutionTemplateLiteral(name)?name.text:ts.isTemplateExpression(name)?name.head.text:null)
                const template=label&&templates.find(row=>row.exact===label||(row.prefix&&label.startsWith(row.prefix)))
                if(template&&fn)matches.push({key:template.key,path:file.path,line:sf.getLineAndCharacterOfPosition(name.getStart(sf)).line+1,
                    label,operation:fn.getText(sf).includes('clipboard.writeText')?'clipboard':'rule-write'})
            }
            ts.forEachChild(node,walk)
        }
        walk(sf)
    }
    return matches
}

export const buildProjectCoverage = ({root,seed,baseline,catalog,reader}) => {
    const source=catalog.sources.find(row=>row.id===baseline.source)
    if(!source||source.commit!==baseline.commit)throw new Error('上游全量清单与固定基线不同，需复核后再生成')
    const upstreamPaths=new Set(baseline.files), bySource=new Map()
    for(const row of catalog.sourceFiles)if(row.upstream?.source===source.id)bySource.set(row.upstream.path,row)
    const controlByKey=new Map(catalog.controls.map(row=>[row.key,row]))
    const configById=new Map(catalog.configurations.map(row=>[row.id,row]))
    const actionByKey=new Map(catalog.actions.map(row=>[row.key,row]))
    const featureById=new Map(catalog.features.map(row=>[row.id,row]))
    const checks=[]
    const requireRow=(map,key,label)=>{
        if(!map.has(key))throw new Error(`未登记的${label}：${key}`)
        return map.get(key)
    }
    const pinned = refs => refs.map(ref=>{
        if(!upstreamPaths.has(ref.path))throw new Error(`基线证据路径不存在：${ref.path}`)
        return ref
    })
    const localRef = ([file,anchor]) => {
        if(!fs.existsSync(path.join(root,file)))throw new Error(`实施文件不存在：${file}`)
        const hits=reader.file(file).text.split(/\r?\n/).flatMap((text,i)=>text.includes(anchor)?[i+1]:[])
        if(hits.length!==1)throw new Error(`覆盖登记锚点应唯一：${file} / ${anchor}（${hits.length}）`)
        return {path:file,line:hits[0],anchor}
    }
    const entries=seed.entries.map(entry=>({...entry,refs:entry.refs.map(localRef),
        featureIds:(entry.featureIds??[]).map(id=>requireRow(featureById,id,'功能').id)}))
    const usedPaths=new Map()
    const note=(file,kind,id)=>{
        if(!usedPaths.has(file))usedPaths.set(file,{})
        const row=usedPaths.get(file)
        if(!row[kind])row[kind]=new Set()
        row[kind].add(id)
    }
    const styles=styleRules(catalog.sourceFiles,reader)
    const knownStyles=new Set(catalog.sourceFiles.filter(row=>/\.(scss|css)$/.test(row.path)).map(row=>row.path))
    const byDefinition=new Map()
    for(const row of catalog.declarations) {
        const id=row.path+'\0'+row.key
        if(!byDefinition.has(id))byDefinition.set(id,[])
        byDefinition.get(id).push(row)
    }
    const baselineDefinitions=baseline.declarations.map(row=>{
        const {source:from,...other}=row
        pinned([from,...row.styleRefs])
        const localFile=bySource.get(from.path)?.path??from.path
        const options=byDefinition.get(localFile+'\0'+row.key)??[]
        const control=controlByKey.get(row.key)
        const excluded=control?.tags.product.includes('not-offered')??false
        if(!excluded&&options.length!==1)checks.push({kind:'baseline-definition-needs-review',id:row.id,key:row.key,matchCount:options.length})
        return {...other,source:from,localDefinitionIds:options.map(row=>row.id),status:excluded?'excluded':options.length===1?'linked':'needs-review'}
    })
    const fromBaseline=new Map()
    for(const row of baselineDefinitions)for(const id of row.localDefinitionIds) {
        if(!fromBaseline.has(id))fromBaseline.set(id,[])
        fromBaseline.get(id).push(row)
    }
    const stages=catalog.declarations.map(row=>{
        const control=requireRow(controlByKey,row.key,'控件'), from=fromBaseline.get(row.id)??[]
        const excluded=control.tags.product.includes('not-offered')
        const attribute=row.styleBinding.attribute, css=[]
        const noteOverride=seed.declarationNotes?.[row.key]
        const observedRefs=noteOverride?.refs.map(localRef)??[]
        if(row.styleBinding.mode!=='none') {
            if(attribute.state==='literal')css.push(...(styles.get(attribute.value)??[]))
            for(const name of row.styleBinding.returnedAttributes??[])css.push(...(styles.get(name)??[]))
            if(attribute.state!=='literal'&&!row.styleBinding.returnedAttributes?.length)for(const ref of from.flatMap(item=>item.styleRefs)) {
                const local=bySource.get(ref.path)?.path??ref.path
                if(knownStyles.has(local))css.push({path:local,relation:'baseline-style-candidate',upstreamLine:ref.line})
            }
        }
        const paths=uniq([row.path,...css.map(item=>item.path),...observedRefs.map(item=>item.path)])
        const method=noteOverride?.mechanism??(control.tags.purpose.includes('filtering')?'object-filter':
            row.type==='webdav'?'connection-form':row.callbacks.length&&css.length?'style-and-callback':
            row.callbacks.length?'callback':css.length?'attribute-style':'needs-review')
        if(!excluded&&method==='needs-review')checks.push({kind:'implementation-link-needs-review',id:row.id,key:row.key})
        if(!excluded&&attribute.state==='unresolved'&&row.styleBinding.mode!=='none'&&!row.styleBinding.returnedAttributes?.length)
            checks.push({kind:'dynamic-style-attribute',id:row.id,key:row.key})
        for(const file of paths)note(file,'declarations',row.id)
        return {id:row.id,key:row.key,controlId:control.id,featureIds:control.featureIds,path:row.path,line:row.line,
            mechanism:method,status:excluded?'excluded':method==='needs-review'?'needs-review':method==='inactive-style'?'inactive':'traced',
            common:['items'],baselineIds:from.map(item=>item.id),callbacks:row.callbacks,css,refs:observedRefs,
            ...(noteOverride?{detail:noteOverride.detail}:{}),
            ...(row.callbacks.some(item=>item.name==='enableFn')&&!row.callbacks.some(item=>item.name==='disableFn')?{disable:'no-explicit-callback'}:{})}
    })
    const stageById=new Map(stages.map(row=>[row.id,row]))
    const controls=catalog.controls.map(row=>{
        const configuration=configById.get(row.configurationId)
        const definitions=row.declarationIds.map(id=>requireRow(stageById,id,'声明'))
        const refs=row.locations.filter(loc=>loc.line!=null)
        const binding=definitions.length?'declaration':configuration&&refs.length?'storage-field':'needs-review'
        const status=row.tags.product.includes('not-offered')?'excluded':definitions.length&&definitions.every(item=>item.status==='inactive')?'inactive':
            binding==='needs-review'||definitions.some(item=>item.status==='needs-review')?'needs-review':'traced'
        if(status==='needs-review'&&binding==='needs-review')checks.push({kind:'control-needs-review',id:row.id,key:row.key})
        for(const ref of refs)note(ref.path,'controls',row.id)
        return {id:row.id,key:row.key,status,binding,configurationId:row.configurationId,field:row.field??null,
            definitionIds:row.declarationIds,refs}
    })
    const contexts=contextMenus(catalog.sourceFiles,reader)
    const historical=new Set(seed.historicalActionKeys)
    const actions=catalog.actions.map(action=>{
        const context=contexts.filter(row=>row.key===action.key)
        const refs=[...action.locations.filter(row=>row.line!=null),...context]
        const status=action.tags.product.includes('not-offered')?'excluded':historical.has(action.key)?'historical':refs.length?'traced':'needs-review'
        if(status==='needs-review')checks.push({kind:'action-needs-review',id:action.id,key:action.key})
        for(const ref of refs)note(ref.path,'actions',action.id)
        const supplemental=seed.localFeatureGroups.filter(row=>row.actionKeys.includes(action.key)).map(row=>row.id)
        const common=context.length?['context-menu']:action.key.startsWith('config-')||action.key==='menu-configuration'?['storage']:['panel-and-menu']
        return {id:action.id,key:action.key,label:action.name,status,featureIds:uniq([...action.featureIds,...supplemental]),common,refs}
    })
    const chainFiles=(rows,fn)=>rows.flatMap(chain=>fn(chain))
    const chainRefs=[...catalog.filterChainCommon.shared.flatMap(row=>row.refs),...catalog.filterChainCommon.strategyCore.refs,
        ...chainFiles(catalog.implementationChains,chain=>[...chain.shared.flatMap(row=>row.refs),...chain.strategies.flatMap(row=>row.refs),
            ...chain.pages.flatMap(page=>page.stages.flatMap(row=>row.refs))])]
    for(const ref of chainRefs)note(ref.path,'chains','object-filter')
    for(const row of entries)for(const ref of row.refs)note(ref.path,'entries',row.id)
    const legacyActionLinks={
        'I-06':'comment-filter','I-09':'dynamic-filter','I-10':'comment-filter','I-11':'comment-filter',
        'I-12':'filter-common','I-13':'filter-common','I-14':'filter-common',
    }
    const contextOccurrence=new Map()
    const baseActions=baseline.actions.map(row=>{
        pinned(row.refs)
        const mapped=seed.actionMappings[row.id]
        let current=(Array.isArray(mapped)?mapped:mapped?[mapped]:[]).map(key=>requireRow(actionByKey,key,'动作').id)
        let exactContext=[]
        if(!current.length&&/^A-CTX-(?!00$)/.test(row.id)) {
            const samePage=contexts.filter(match=>row.refs.some(ref=>ref.path===match.path))
            const label=row.effect.match(/“([^”]+)”/)?.[1]?.split('${')[0]
            const candidates=samePage.filter(match=>label&&match.label===label).sort((a,b)=>a.line-b.line)
            const signature=(row.refs[0]?.path??'')+'\0'+label, occurrence=contextOccurrence.get(signature)??0
            if(candidates[occurrence])exactContext=[candidates[occurrence]]
            contextOccurrence.set(signature,occurrence+1)
            current=uniq(exactContext.map(match=>actionByKey.get(match.key)?.id))
        }
        const entry=entries.find(entry=>entry.legacyActions?.includes(row.id))?.id??legacyActionLinks[row.id]
        const excluded=current.length&&current.every(id=>actions.find(item=>item.id===id)?.status==='excluded')
        const localRefs=exactContext.map(hit=>({path:hit.path,line:hit.line}))
        if(!current.length&&!entry)checks.push({kind:'baseline-action-needs-review',id:row.id})
        return {...row,currentActionIds:current,entry:entry??null,localRefs,
            status:excluded?'excluded':current.length||entry?'linked':'needs-review',
            ...(row.id==='A-MENU-07'?{difference:'旧悬浮显隐菜单已改为快捷入口设置。'}:{})}
    })
    const baseState=baseline.storage.map(row=>{
        pinned(row.refs)
        const id=(row.storage==='localStorage'?'local':'gm')+':'+row.key
        const config=configById.get(id)
        const entry=row.key.startsWith('BILICLEANER_')||row.key==='__MIGRATED__'?'storage':
            row.key==='bili-cleaner-side-btn-show'?'panel-and-menu':row.key==='theme_style（B 站 Cookie）'?'F-COM-DARK':null
        const status=config?.productDefaultStatus==='not-applicable'||entry==='F-COM-DARK'?'excluded':config||entry?'linked':'needs-review'
        if(status==='needs-review')checks.push({kind:'baseline-storage-needs-review',key:row.key})
        return {...row,configurationId:config?.id??null,entry,status}
    })
    const featureEntries=catalog.features.map(feature=>{
        const definitions=stages.filter(row=>row.featureIds.includes(feature.id))
        const entryIds=entries.filter(row=>row.featureIds.includes(feature.id)).map(row=>row.id)
        const supplemental=seed.localFeatureGroups.find(row=>row.id===feature.id)
        const actionIds=actions.filter(row=>row.featureIds.includes(feature.id)).map(row=>row.id)
        const chainIds=siteFilterIds.filter(id=>definitions.some(row=>catalog.implementationChains.find(chain=>chain.id===id)?.pages.some(page=>page.controlIds.includes(row.controlId))))
        if(feature.id==='F-HDR-DYN-FILTER')chainIds.push('dynamic-filter')
        const paths=uniq([...definitions.flatMap(row=>[row.path,...row.css.map(ref=>ref.path),...row.refs.map(ref=>ref.path)]),
            ...entries.filter(row=>entryIds.includes(row.id)).flatMap(row=>row.refs.map(ref=>ref.path)),
            ...(supplemental?.paths??[]).flatMap(prefix=>catalog.sourceFiles.filter(row=>row.path===prefix||(prefix.endsWith('/')&&row.path.startsWith(prefix))).map(row=>row.path))])
        for(const file of paths)note(file,'features',feature.id)
        const status=feature.tags.product.every(value=>value==='not-offered')?'excluded':definitions.some(row=>row.status==='needs-review')?'partly-traced':
            definitions.length&&definitions.every(row=>row.status==='inactive')?'inactive':definitions.length||entryIds.length||chainIds.length||paths.length?'traced':'needs-review'
        if(status==='needs-review')checks.push({kind:'feature-needs-review',id:feature.id})
        const baselineIds=baselineDefinitions.filter(row=>row.featureId===feature.id).map(row=>row.id)
        return {id:feature.id,label:feature.label,status,definitionIds:definitions.map(row=>row.id),baselineIds,actionIds,entryIds,chainIds,paths,
            missing:supplemental?.missing??null}
    })
    const classifyRepository = p => /^images\//.test(p)?'asset':/^\.github\/ISSUE_TEMPLATE\//.test(p)?'issue-template':
        /^\.github\/workflows\//.test(p)?'upstream-workflow':/^(README|CHANGELOG|NOTE|LICENSE)/.test(p)?'project-document':
        /^(vite\.config|package\.json|pnpm|tsconfig|postcss)/.test(p)?'build-config':'upstream-tooling'
    const importedBy=new Map()
    for(const row of catalog.sourceFiles)for(const imported of row.staticImports) {
        if(!importedBy.has(imported))importedBy.set(imported,[])
        importedBy.get(imported).push(row.path)
    }
    const fileRows=baseline.files.map(p=>{
        const retired=seed.retiredUpstreamFiles?.includes(p)??false
        const indexed=bySource.get(p)
        const local=indexed?.path??(p==='vite.config.ts'?p:null)
        if(p.startsWith('src/')&&!indexed&&!retired)throw new Error(`上游源码未对应：${p}`)
        const family=retired?{kind:'retired',detail:'自带夜间模式及其专用依赖已撤出产品。'}:
            p.startsWith('src/')?sourceFamilies(seed,local):{kind:classifyRepository(p),detail:seed.repositoryNotes?.[p]??'上游仓库配套文件，按构建、工作流、资料或资源登记。'}
        const links=Object.fromEntries(Object.entries(usedPaths.get(local)??{}).map(([key,value])=>[key,[...value].sort()]))
        const status=retired?'excluded':
            Object.keys(links).length?'traced':p.startsWith('src/')?'support-indexed':'repository-entry'
        return {path:p,localPath:local,kind:family.kind,detail:family.detail,status,
            comparison:indexed?.status??null,imports:indexed?.staticImports??[],importedBy:importedBy.get(local)??[],links,
            sourceUrl:`${source.repository}/blob/${source.commit}/${p}`}
    })
    const localOnly=catalog.sourceFiles.filter(row=>!row.upstream||row.upstream.source!==source.id).map(row=>{
        const family=sourceFamilies(seed,row.path), links=Object.fromEntries(Object.entries(usedPaths.get(row.path)??{}).map(([key,value])=>[key,[...value].sort()]))
        return {path:row.path,kind:family.kind,detail:family.detail,origin:row.upstream??row.provenance,imports:row.staticImports,
            importedBy:importedBy.get(row.path)??[],links}
    })
    return {source, baselineEvidence:baseline.evidence, files:fileRows,localOnly,features:featureEntries,controls,declarations:stages,
        actions,baselineDefinitions,baselineActions:baseActions,baselineStorage:baseState,entries,checks,
        counts:{upstreamFiles:fileRows.length,upstreamSourceFiles:fileRows.filter(row=>row.path.startsWith('src/')).length,
            upstreamDeclarations:baselineDefinitions.length,upstreamActions:baseActions.length,upstreamState:baseState.length,
            features:featureEntries.length,controls:controls.length,declarations:stages.length,actions:actions.length,needsReview:checks.length}}
}

export const renderCoverage = coverage => {
    const labels={traced:'有实现指向',inactive:'声明保留、实现不生效',excluded:'用户明确排除',historical:'历史编号',
        'support-indexed':'共用支撑／装配索引','repository-entry':'仓库配套', 'excluded-still-present':'明确排除、代码仍在',
        linked:'已对应','needs-review':'待定位','partly-traced':'部分已定位'}
    const count=(rows,status)=>rows.filter(row=>row.status===status).length
    const lines=['# 全量实现登记审阅','','范围：净化大师固定基线 15d9bce（4.5.13）和当前本地产品。4.5.15 是参考更新候选。','',
        `- 上游仓库 ${coverage.counts.upstreamFiles} 个文件，其中 src 下 ${coverage.counts.upstreamSourceFiles} 个均已对应。仓库配套按工作流、构建、文档及资源另列。`,
        `- 原盘点 ${coverage.counts.upstreamDeclarations} 处声明、${coverage.counts.upstreamActions} 项动作/隐式行为、${coverage.counts.upstreamState} 条存储记录均有去向。`,
        `- 当前 ${coverage.counts.features} 个分组、${coverage.counts.controls} 个设置控件、${coverage.counts.declarations} 处声明、${coverage.counts.actions} 项菜单/动作。声明：${count(coverage.declarations,'traced')} 有实现指向，${count(coverage.declarations,'inactive')} 未生效，${count(coverage.declarations,'excluded')} 明确排除。`,
        `- 登记关系缺口：${coverage.checks.length}。这里是源码覆盖，并非实机验收，也不代表每个实现、每行代码都经过行为验证。`,
        '', '## 审阅方法','',
        '- `pnpm catalog --find S076`：按编号看配置声明、当前回调、样式指向及固定上游对应。',
        '- `pnpm catalog --find F-VID-SHARE`：按功能看普通视频和番剧的两处实现。',
        '- `pnpm catalog --coverage src/modules/rules/live/groups/basic.ts`：按源文件看对应关系与使用者。',
        '- `pnpm catalog --coverage`：查看登记关系缺口。对象过滤继续按四步审阅，其它实现按实际执行方式登记。',
        '', '## 需要单列的现状','']
    for(const row of coverage.declarations.filter(row=>row.status==='inactive'||row.status==='excluded'))
        lines.push(`- ${row.controlId} \`${row.key}\`：${labels[row.status]}。${row.detail??''} \`${row.path}:${row.line}\``)
    lines.push('','## 共用执行与非开关行为','')
    for(const row of coverage.entries)lines.push(`- **${row.label}**：${row.detail}`,`  - ${row.refs.map(ref=>`\`${ref.path}:${ref.line}\``).join('、')}`)
    lines.push('','## 功能登记','')
    for(const row of coverage.features)lines.push(`- ${row.id} ${row.label}：${labels[row.status]}；声明 ${row.definitionIds.length}，动作 ${row.actionIds.length}${row.chainIds.length?'；过滤链 '+row.chainIds.join('、'):''}${row.entryIds.length?'；共用 '+row.entryIds.join('、'):''}。`)
    lines.push('','## 上游文件去向','')
    for(const row of coverage.files)lines.push(`- [${row.path}](${row.sourceUrl})：${labels[row.status]}${row.localPath?' → `'+row.localPath+'`':''}。${row.status==='traced'?'':row.detail}`)
    lines.push('','## 本地扩展与其他来源','')
    for(const row of coverage.localOnly)lines.push(`- \`${row.path}\`：${row.detail}${typeof row.origin==='object'?` [固定来源](${row.origin.url})。`:''}`)
    return lines.join('\n')+'\n'
}

export const coverageForPath=(coverage,path)=>{
    const file=coverage.files.find(row=>row.path===path||row.localPath===path)??coverage.localOnly.find(row=>row.path===path)
    if(!file)return null
    return {file,entries:coverage.entries.filter(row=>row.refs.some(ref=>ref.path===(file.localPath??file.path))),
        controls:coverage.controls.filter(row=>row.refs.some(ref=>ref.path===(file.localPath??file.path))),
        declarations:coverage.declarations.filter(row=>row.path===(file.localPath??file.path)||[...row.css,...row.refs].some(ref=>ref.path===(file.localPath??file.path))),
        actions:coverage.actions.filter(row=>row.refs.some(ref=>ref.path===(file.localPath??file.path)))}
}
