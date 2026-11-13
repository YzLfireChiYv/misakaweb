import ts from 'typescript'

const labels = {locate:'找到卡片',fields:'获取信息',decide:'独立判断留下或不留下',layout:'整理页面'}
const statuses = {implemented:'有源码实现',optional:'独立可选',experimental:'实验功能',natural:'依赖站点自然排布',missing:'未实现','target-only':'目标边界，尚未拆出','current-coupled':'当前策略，仍与页面耦合'}
const providers = {dom:'对象 DOM', 'site-state':'站点组件数据', 'site-vue-state':'站点 Vue 数据', 'site-response-or-state':'站点响应或页面状态','page-url':'页面地址'}
const ruleTypes = {blackPairs:'普通黑名单',whitePairs:'白名单',forceBlackPairs:'强制黑名单'}
const unique = values => [...new Set(values)].sort()
const walk = (node, fn) => {
    fn(node)
    ts.forEachChild(node, child => walk(child, fn))
}

/** Relate reviewed stages to source evidence and read rule/field bindings from current syntax. */
const evidenceResolver = (reader,sourceFiles) => {
    const sources=new Set(sourceFiles.map(row=>row.path))
    return ([path,anchor])=>{
        if(!sources.has(path))throw new Error(`实现链文件未登记：${path}`)
        const hits=reader.file(path).text.split(/\r?\n/).flatMap((line,i)=>line.includes(anchor)?[i+1]:[])
        if(hits.length!==1)throw new Error(`实现链锚点应唯一：${path} / ${anchor}（命中 ${hits.length}）`)
        return {path,line:hits[0],anchor}
    }
}

export const buildFilterCommon = (seed,reader,sourceFiles) => {
    const ref=evidenceResolver(reader,sourceFiles)
    return {...seed,shared:seed.shared.map(row=>({...row,refs:row.refs.map(ref)})),
        strategyCore:{...seed.strategyCore,refs:seed.strategyCore.refs.map(ref)}}
}

const sharedForChain = (chain,common) => [...common.shared,...chain.shared]
const chainSharedIds = (mode,extras=[]) => ['page-dispatch','paint-decisions',`hide-${mode}`,'natural-layout','visible-item-refill',...extras]

export const buildVideoChain = ({ seed, reader, declarations, controls, sourceFiles, common }) => {
    if(seed.schemaVersion!==2||common.decisionContract.outcomes.join(',')!=='keep,discard')
        throw new Error('视频过滤登记须使用四步链和二选一判断契约')
    const ref=evidenceResolver(reader,sourceFiles)
    const controlKeys=new Set(controls.map(row=>row.key))
    const references=new Set(seed.referenceSources.map(row=>row.id))
    const shared=seed.shared.map(row=>{
        if(!Object.hasOwn(labels,row.stage)||row.stage==='decide')throw new Error(`判断策略不能登记为共用依赖：${row.id}`)
        for(const key of row.keys??[])if(!controlKeys.has(key))throw new Error(`实现链引用未知配置：${row.id} ${key}`)
        for(const id of row.referenceIds??[])if(!references.has(id))throw new Error(`未知的参考来源：${id}`)
        return {...row,refs:row.refs.map(ref),
            controlIds:controls.filter(control=>row.keys?.includes(control.key)||control.featureIds.includes(row.featureId)).map(control=>control.id)}
    })
    const sharedIds=new Set([...common.shared,...shared].map(row=>row.id))
    if(sharedIds.size!==common.shared.length+shared.length)throw new Error('视频过滤共用环节 ID 重复')
    const strategies=seed.strategies.map(row=>({...row,refs:row.refs.map(ref),
        ...(row.id==='current-rules'?{coreStrategyId:common.strategyCore.id}:{})}))
    if(!strategies.some(row=>row.id==='current-rules'))throw new Error('缺少当前视频过滤策略登记')
    const registryPath='src/modules/filters/index.ts'
    const registry=reader.file(registryPath)
    const registrations=registry.variables.get('videoFilters')
    if(!registrations||!ts.isArrayLiteralExpression(registrations))throw new Error('无法读取视频过滤页面注册')
    const registered=new Map(registrations.elements.map(row=>{
        if(!ts.isObjectLiteralExpression(row))throw new Error('视频过滤注册形状已变化，需复核实现链')
        const props=new Map(row.properties.filter(ts.isPropertyAssignment).map(prop=>[prop.name.getText(registry.sf),prop.initializer]))
        return [props.get('entry')?.getText(registry.sf),{path:registryPath,
            line:registry.sf.getLineAndCharacterOfPosition(row.getStart(registry.sf)).line+1,
            checkFn:props.get('checkFn')?.getText(registry.sf)}]
    }))
    const pageEntries=seed.pages.map(row=>`videoFilter${row.id[0].toUpperCase()}${row.id.slice(1)}Entry`)
    if(new Set(pageEntries).size!==seed.pages.length||registered.size!==seed.pages.length||pageEntries.some(entry=>!registered.has(entry)))
        throw new Error('视频过滤的注册入口与已登记页面不一致，需复核实现链')
    const pages=seed.pages.map(({id,label,routes,locator,locatorAnchors,fieldNotes,fieldProvider,fieldProviders,fieldAnchors=[],additionalFields=[],strategyMetrics={},layoutNotes,refillNotes,extras})=>{
        const path=`src/modules/filters/variety/video/pages/${id}.ts`
        const {sf,variables}=reader.file(path)
        const line=node=>sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1
        const selectorFns=variables.get('selectorFns')
        if(!selectorFns||!ts.isObjectLiteralExpression(selectorFns))throw new Error(`无法定位字段提取：${path}`)
        const extracted=selectorFns.properties.filter(ts.isPropertyAssignment).map(property=>{
            const field=property.name.getText(sf),selectors=[],attributes=[],helpers=[]
            walk(property.initializer,node=>{
                if(!ts.isCallExpression(node))return
                if(ts.isPropertyAccessExpression(node.expression)&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])) {
                    if(node.expression.name.text==='querySelector')selectors.push(node.arguments[0].text)
                    if(node.expression.name.text==='getAttribute')attributes.push(node.arguments[0].text)
                }
                if(ts.isIdentifier(node.expression)&&['getVideoData','convertTimeToSec','convertDateToDays','matchBvid','calcQuality','calcVideoRelativity'].includes(node.expression.text))
                    helpers.push(node.expression.text)
            })
            return {field,provider:fieldProviders?.[field]??fieldProvider??'dom',path,line:line(property),
                selectors:[...new Set(selectors)],attributes:unique(attributes),helpers:unique(helpers)}
        })
        const fields=[...extracted.filter(row=>!Object.hasOwn(strategyMetrics,row.field)),...additionalFields.map(({field,provider,anchor,detail})=>({
            field,provider,detail,...ref([path,anchor]),selectors:[],attributes:[],helpers:[],
        }))]
        const metrics=extracted.filter(row=>Object.hasOwn(strategyMetrics,row.field))
            .map(row=>({...row,...strategyMetrics[row.field]}))
        const definitions=new Map(declarations.filter(row=>row.path===path).map(row=>[row.line,row.key]))
        const keysByFilter=new Map(), rules=[], selectors=[]
        const literal = value => value&&(ts.isStringLiteral(value)||ts.isNoSubstitutionTemplateLiteral(value))
        walk(sf,node=>{
            if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&['selector','cardSelector'].includes(node.name.text)&&literal(node.initializer))
                selectors.push({selector:node.initializer.text.replace(/\s+/g,' ').trim(),path,line:line(node)})
            if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&node.left.getText(sf)==='selector'&&literal(node.right)) {
                let parent=node.parent
                while(parent&&!ts.isIfStatement(parent))parent=parent.parent
                selectors.push({selector:node.right.text,path,line:line(node),condition:parent?.expression.getText(sf)})
            }
            if(ts.isObjectLiteralExpression(node)&&definitions.has(line(node))) {
                const key=definitions.get(line(node))
                walk(node,child=>{
                    if(!ts.isPropertyAccessExpression(child)||!ts.isIdentifier(child.expression)||child.expression.text!=='mainFilter')return
                    if(!keysByFilter.has(child.name.text))keysByFilter.set(child.name.text,new Set())
                    keysByFilter.get(child.name.text).add(key)
                })
            }
            if(!ts.isCallExpression(node)||!ts.isPropertyAccessExpression(node.expression)||node.expression.name.text!=='push')return
            const group=node.expression.expression.getText(sf),pair=node.arguments[0]
            if(!Object.hasOwn(ruleTypes,group)||!pair||!ts.isArrayLiteralExpression(pair))return
            const [filter,extractor]=pair.elements
            if(!filter||!extractor||!ts.isPropertyAccessExpression(filter)||!ts.isPropertyAccessExpression(extractor))
                throw new Error(`无法解析过滤规则与字段的绑定：${path}:${line(node)}`)
            rules.push({group,filter:filter.name.text,field:extractor.name.text,path,line:line(node)})
        })
        for(const rule of rules) {
            if(!extracted.some(field=>field.field===rule.field))throw new Error(`规则字段不存在：${path} ${rule.field}`)
            rule.keys=[...(keysByFilter.get(rule.filter)??[])].sort()
            if(!rule.keys.length)throw new Error(`规则未关联到配置：${path} ${rule.filter}`)
        }
        if(!rules.length)throw new Error(`未找到页面的规则绑定：${path}`)
        const sharedStageIds=chainSharedIds('sign',['field-conversion','video-statistics','general-tag-data',...extras])
        if(sharedStageIds.some(key=>!sharedIds.has(key)))throw new Error(`页面引用了不存在的共用环节：${id}`)
        const controlIds=unique([...controls.filter(row=>[...definitions.values()].includes(row.key)).map(row=>row.id),
            ...shared.filter(row=>sharedStageIds.includes(row.id)).flatMap(row=>row.controlIds)])
        const registration=registered.get(`videoFilter${id[0].toUpperCase()}${id.slice(1)}Entry`)
        if(!selectors.length)throw new Error(`未找到页面的卡片选择器：${path}`)
        return {id,label,routes,controlIds,sharedStageIds,fields,selectors,registration,
            currentStrategy:{id:'current-rules',bindings:rules,metrics},stages:[
            {stage:'locate',status:'implemented',detail:locator,refs:[registration,...locatorAnchors.map(anchor=>ref([path,anchor]))]},
            {stage:'fields',status:'implemented',detail:fieldNotes,refs:['const selectorFns =',...fieldAnchors].map(anchor=>ref([path,anchor]))},
            {stage:'decide',status:common.decisionContract.status,detail:'此页绑定字段和当前规则，交给独立判断入口。',refs:[{path,line:rules[0].line}]},
            {stage:'layout',status:'natural',detail:layoutNotes,refill:{status:'missing',detail:refillNotes},
                refs:[ref([path,"videos.forEach((v) => restoreFiltered(v, 'sign'))"])]},
        ]}
    })
    return {id:seed.id,label:seed.label,objectLabel:'卡片',verification:seed.verification,decisionContractId:common.decisionContract.id,
        referenceSources:seed.referenceSources,strategies,shared,pages,auditNotes:seed.auditNotes}
}

/** Non-video pages share the same four stages; only evidence and current rule bindings differ. */
export const buildObjectChains = ({seed,reader,declarations,controls,sourceFiles,common}) => {
    const ref=evidenceResolver(reader,sourceFiles)
    const registryPath='src/modules/filters/index.ts',registry=reader.file(registryPath)
    const byKey=new Map(controls.map(row=>[row.key,row]))
    return seed.chains.map(chain=>{
        const array=registry.variables.get(chain.registry)
        if(!array||!ts.isArrayLiteralExpression(array))throw new Error(`找不到过滤入口：${chain.registry}`)
        const registered=new Map(array.elements.map(row=>{
            if(!ts.isObjectLiteralExpression(row))throw new Error(`过滤入口形状已变化：${chain.registry}`)
            const props=new Map(row.properties.filter(ts.isPropertyAssignment).map(prop=>[prop.name.getText(registry.sf),prop.initializer.getText(registry.sf)]))
        return [props.get('entry'),{path:registryPath,line:registry.sf.getLineAndCharacterOfPosition(row.getStart(registry.sf)).line+1,
            checkFn:props.get('checkFn')?.replace(/\s+/g,' ').trim()}]
        }))
        const pageEntries=new Set(chain.pages.map(page=>page.entry))
        if(pageEntries.size!==registered.size||[...pageEntries].some(key=>!registered.has(key)))throw new Error(`过滤入口有未登记变化：${chain.id}`)
        const shared=(chain.shared??[]).map(row=>({...row,refs:row.refs.map(ref)}))
        const available=new Set([...common.shared,...shared].map(row=>row.id))
        const pages=chain.pages.map(page=>{
            const path=page.file,{sf,variables}=reader.file(path)
            const at=node=>sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1
            const selectorFns=variables.get('selectorFns')
            if(!selectorFns||!ts.isObjectLiteralExpression(selectorFns))throw new Error(`找不到字段提取：${path}`)
            const group=page.fieldGroup?selectorFns.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(sf)===page.fieldGroup)?.initializer:selectorFns
            if(!group||!ts.isObjectLiteralExpression(group))throw new Error(`找不到字段组：${path} ${page.fieldGroup}`)
            const extracted=group.properties.filter(ts.isPropertyAssignment).map(prop=>{
                const field=prop.name.getText(sf),selectors=[],attributes=[]
                const detail=page.fieldDetails[field]
                if(!detail)throw new Error(`字段缺少说明：${path} ${field}`)
                walk(prop.initializer,node=>{
                    if(!ts.isCallExpression(node)||!ts.isPropertyAccessExpression(node.expression))return
                    const argument=node.arguments[0]
                    if(!argument||!(ts.isStringLiteral(argument)||ts.isNoSubstitutionTemplateLiteral(argument)))return
                    if(['querySelector','querySelectorAll'].includes(node.expression.name.text))selectors.push(argument.text.replace(/\s+/g,' ').trim())
                    if(node.expression.name.text==='getAttribute')attributes.push(argument.text)
                })
                return {field,path,line:at(prop),provider:chain.id==='comment-filter'?'site-state':'dom',detail,selectors,attributes,helpers:[]}
            })
            if(extracted.length!==Object.keys(page.fieldDetails).length)throw new Error(`已登记字段与源码不符：${path}`)
            const fields=extracted.filter(row=>row.field!=='isReplyToFiltered')
            const declarationKeys=new Map(declarations.filter(row=>row.path===path).map(row=>[row.line,row.key]))
            const keysByFilter=new Map(),bindings=[]
            walk(sf,node=>{
                if(ts.isObjectLiteralExpression(node)&&declarationKeys.has(at(node)))walk(node,child=>{
                    if(!ts.isPropertyAccessExpression(child)||child.expression.getText(sf)!=='mainFilter')return
                    const key=child.name.text
                    if(!keysByFilter.has(key))keysByFilter.set(key,new Set())
                    keysByFilter.get(key).add(declarationKeys.get(at(node)))
                })
                // Header uses saved dynamic-page keys, with no declarations of its own.
                if(page.sharedSettings&&ts.isIfStatement(node)&&ts.isCallExpression(node.expression)&&node.expression.expression.getText(sf)==='GM_getValue') {
                    const condition=reader.value(node.expression.arguments[0],path)
                    walk(node.thenStatement,child=>{
                        if(!ts.isCallExpression(child)||!ts.isPropertyAccessExpression(child.expression)||child.expression.name.text!=='enable')return
                        const filter=child.expression.expression.getText(sf).match(/^mainFilter\.(\w+)$/)?.[1]
                        if(filter&&typeof condition==='string')keysByFilter.set(filter,new Set([condition]))
                    })
                }
            })
            if(page.sharedSettings)walk(sf,node=>{
                if(!ts.isCallExpression(node)||!ts.isPropertyAccessExpression(node.expression)||node.expression.name.text!=='setParam')return
                const filter=node.expression.expression.getText(sf).match(/^this\.(\w+)$/)?.[1],arg=node.arguments[0]
                if(!filter||!arg||!ts.isCallExpression(arg)||arg.expression.getText(sf)!=='GM_getValue')return
                const key=reader.value(arg.arguments[0],path)
                if(typeof key==='string'&&keysByFilter.has(filter))keysByFilter.get(filter).add(key)
            })
            let method
            walk(sf,node=>{if(ts.isMethodDeclaration(node)&&node.name.getText(sf)===page.method)method=node})
            if(!method)throw new Error(`找不到检查方法：${path} ${page.method}`)
            walk(method,node=>{
                if(!ts.isCallExpression(node)||!ts.isPropertyAccessExpression(node.expression)||node.expression.name.text!=='push')return
                const group=node.expression.expression.getText(sf),pair=node.arguments[0]
                if(!Object.hasOwn(ruleTypes,group)||!pair||!ts.isArrayLiteralExpression(pair))return
                const [filter,field]=pair.elements
                if(!ts.isPropertyAccessExpression(filter)||!ts.isPropertyAccessExpression(field))throw new Error(`规则绑定已变化：${path}:${at(node)}`)
                bindings.push({group,filter:filter.name.text,field:field.name.text,path,line:at(node)})
            })
            if(page.fieldGroup==='sub')bindings.push({group:'blackPairs',filter:'commentChainFilter',field:'isReplyToFiltered',
                parameters:['video-comment-chain-level-value'],
                ...ref([path,'[this.commentChainFilter, selectorFns.sub.isReplyToFiltered]'])})
            if(!bindings.length)throw new Error(`没有提取到规则绑定：${path} ${page.method}`)
            for(const row of bindings) {
                row.keys=unique([...(keysByFilter.get(row.filter)??[]),...(row.parameters??[])])
                if(!extracted.some(field=>field.field===row.field)||(!row.keys.length&&row.filter!=='commentIsMeFilter'))
                    throw new Error(`规则未关联字段或配置：${path} ${row.filter}`)
            }
            const controlIds=unique([...bindings.flatMap(row=>row.keys),...(page.specialKeys??[])].map(key=>{
                if(!byKey.has(key))throw new Error(`未知的规则键：${key}`)
                return byKey.get(key).id
            }))
            const mode=page.shared.includes('hide-style')?'style':'sign'
            const sharedStageIds=chainSharedIds(mode,page.shared.filter(id=>id!==`hide-${mode}`))
            if(sharedStageIds.some(id=>!available.has(id)))throw new Error(`页面引用未知共用阶段：${page.id}`)
            const registration=registered.get(page.entry),refs=anchors=>anchors.map(anchor=>ref([path,anchor]))
            return {id:page.id,label:page.label,routes:page.routes,controlIds,sharedStageIds,fields,selectors:[],registration,
                currentStrategy:{id:chain.strategy.id,bindings,metrics:extracted.filter(row=>row.field==='isReplyToFiltered').map(row=>({...row,inputs:['父回复 ID','当前隐藏回复图']}))},
                stages:[
                    {stage:'locate',status:'implemented',detail:page.locate,refs:[registration,...refs(page.locateRefs)]},
                    {stage:'fields',status:'implemented',detail:page.fields,refs:refs(['const selectorFns ='])},
                    {stage:'decide',status:common.decisionContract.status,detail:page.decide,refs:refs(page.decideRefs)},
                    {stage:'layout',status:'natural',detail:page.layout,missing:page.missing,refs:refs(page.layoutRefs)},
                ]}
        })
        return {id:chain.id,label:chain.label,objectLabel:chain.objectLabel,verification:'逐段核对固定源码；实际网页和布局未做浏览器实测。',
            decisionContractId:common.decisionContract.id,originReview:chain.originReview,shared,pages,
            strategies:[{...chain.strategy,coreStrategyId:common.strategyCore.id,refs:chain.strategy.refs.map(ref)}],
            referenceSources:chain.referenceSources??[],auditNotes:chain.auditNotes??[]}
    })
}

export const chainForControls = (catalog, ids) => {
    const selected=new Set(ids)
    const keys=new Set(catalog.controls.filter(row=>selected.has(row.id)).map(row=>row.key))
    return (catalog.implementationChains??[]).flatMap(chain=>{
        const pages=chain.pages.filter(page=>page.controlIds.some(id=>selected.has(id)))
        return pages.length?[{id:chain.id,pages:pages.map(page=>({id:page.id,label:page.label,
            strategyId:page.currentStrategy.id,
            ruleBindings:page.currentStrategy.bindings.filter(rule=>rule.keys.some(key=>keys.has(key))),
            sharedStages:chain.shared.filter(stage=>page.sharedStageIds.includes(stage.id)&&stage.controlIds?.some(id=>selected.has(id))).map(stage=>stage.id),
        }))}]:[]
    })
}

export const chainFileHits = (catalog, changed) => [
    ...[...catalog.filterChainCommon.shared,{...catalog.filterChainCommon.strategyCore,stage:'decide'}].flatMap(stage=>{
        const files=unique(stage.refs.filter(ref=>changed.has(ref.path)).map(ref=>ref.path))
        const chains=catalog.implementationChains.filter(chain=>stage.stage==='decide'
            ? chain.strategies.some(strategy=>strategy.coreStrategyId===stage.id)
            : chain.pages.some(page=>page.sharedStageIds.includes(stage.id)))
        return files.length?[{chain:'filter-common',chains:chains.map(chain=>chain.id),stage:stage.stage,label:stage.label,
            ...(stage.stage==='decide'?{strategyId:stage.id}:{}),pages:[],files}]:[]
    }),
    ...(catalog.implementationChains??[]).flatMap(chain=>[
    ...chain.shared.flatMap(stage=>{
        const files=unique(stage.refs.filter(ref=>changed.has(ref.path)).map(ref=>ref.path))
        return files.length?[{chain:chain.id,stage:stage.stage,label:stage.label,pages:chain.pages.filter(page=>page.sharedStageIds.includes(stage.id)).map(page=>page.id),files}]:[]
    }),
    ...chain.strategies.flatMap(strategy=>{
        const files=unique(strategy.refs.filter(ref=>changed.has(ref.path)).map(ref=>ref.path))
        return files.length?[{chain:chain.id,stage:'decide',strategyId:strategy.id,label:strategy.label,
            pages:chain.pages.filter(page=>page.currentStrategy.id===strategy.id).map(page=>page.id),files}]:[]
    }),
    ...chain.pages.flatMap(page=>page.stages.flatMap(stage=>{
        const files=unique(stage.refs.filter(ref=>changed.has(ref.path)).map(ref=>ref.path))
        return files.length?[{chain:chain.id,stage:stage.stage,label:labels[stage.stage],pages:[page.id],files}]:[]
    })),
    ]),
]

export const renderFilterChain = (chain, common, sourceFiles, pageQuery) => {
    const pages=pageQuery?chain.pages.filter(page=>page.id===pageQuery||page.routes.includes(pageQuery)):chain.pages
    if(!pages.length)throw new Error(`未登记的${chain.label}页面：${pageQuery}`)
    const files=new Map(sourceFiles.map(row=>[row.path,row]))
    const referenced=new Set()
    const refs = rows => rows.map(({path,line})=>{referenced.add(path);return `\`${path}:${line}\``}).join('、')
    const lines=[`# ${chain.label}实现链${pageQuery?'：'+pages.map(row=>row.label).join('、'):''}`,'',chain.verification,'',
        `四步：找到${chain.objectLabel} → 获取信息 → 独立判断留下或不留下 → 整理页面。源码位置使用仓库相对路径。`,
        '', '判断契约、页面分派、两种隐藏/恢复模式、绘制、自然排布与补载缺口，统一见[过滤共用登记](FILTER-COMMON.generated.md)。',
        '', '## 此类过滤的共用能力（不含判断策略）','']
    const sharedIds=new Set(pages.flatMap(page=>page.sharedStageIds))
    const referenceIds=new Set()
    for(const stage of chain.shared.filter(row=>sharedIds.has(row.id))) {
        lines.push(`- **${stage.label}**｜${labels[stage.stage]}（${statuses[stage.status]}）：${stage.detail}`)
        if(stage.refs.length)lines.push(`  - 源码：${refs(stage.refs)}`)
        for(const input of stage.inputs??[])lines.push(`  - ${input.path}：${input.fields.join('、')}${input.unavailable?.length?'；缺少 '+input.unavailable.join('、'):''}。`)
        for(const id of stage.referenceIds??[])referenceIds.add(id)
    }
    lines.push('','## 可替换的判断策略','', '通用匹配和黑白名单组合见[过滤共用登记](FILTER-COMMON.generated.md)；它属于现行策略。','')
    for(const strategy of chain.strategies) {
        lines.push(`- **${strategy.label}**（${statuses[strategy.status]}）：${strategy.detail}`)
        if(strategy.refs.length)lines.push(`  - 源码：${refs(strategy.refs)}`)
    }
    for(const page of pages) {
        lines.push('',`## ${page.label}（${page.id}）`,'')
        for(const stage of page.stages) {
            lines.push(`- **${stage.stage==='locate'?`找到${chain.objectLabel}`:labels[stage.stage]}**（${statuses[stage.status]}）：${stage.detail}`)
            if(stage.refs.length)lines.push(`  - 源码：${refs(stage.refs)}`)
            if(stage.stage==='locate') {
                lines.push(`  - 注册条件：\`${page.registration.checkFn}\`。`)
                for(const selector of page.selectors)lines.push(`  - ${selector.condition?`条件 \`${selector.condition}\`：`:''}\`${selector.selector}\`。${refs([selector])}`)
            }
            if(stage.stage==='fields')for(const field of page.fields)lines.push(`  - ${field.field}：${providers[field.provider]}${field.selectors.length?'，'+field.selectors.map(value=>`\`${value}\``).join(' 或 '):''}${field.attributes.length?'，取 '+field.attributes.join('、'):''}${field.helpers.length?'；'+field.helpers.join('、'):''}。${field.detail??''}${refs([field])}`)
            if(stage.stage==='decide') {
                for(const metric of page.currentStrategy.metrics)lines.push(`  - 当前策略指标 ${metric.field}：${metric.detail} 输入：${metric.inputs.join('、')}。${refs([metric])}`)
                for(const rule of page.currentStrategy.bindings)lines.push(`  - 当前策略／${ruleTypes[rule.group]}：${rule.field} → ${rule.filter}；${rule.keys.map(key=>`\`${key}\``).join('、')}。${refs([rule])}`)
            }
            if(stage.refill)lines.push(`  - 补载（${statuses[stage.refill.status]}）：${stage.refill.detail}`)
            if(stage.missing?.length)lines.push(`  - 未实现：${stage.missing.join('；')}。`)
        }
        lines.push(`- 引用的共用能力：${sharedForChain(chain,common).filter(row=>page.sharedStageIds.includes(row.id)).map(row=>row.label).join('、')}。`)
    }
    if(!pageQuery) {
        lines.push('','## 此前本地候选与剩余问题','')
        for(const note of chain.auditNotes)lines.push(`- **${note.label}**（${note.status==='fixed'?'此前本地候选已修':'待核对或后续处理'}）：${note.detail}`)
    }
    lines.push('','## 对应的上游文件','', '链接是固定基线的文件对应，不能凭文件关系判定每行作者。本地差异和未核实来源分别保留。','')
    if(chain.originReview)lines.push(chain.originReview,'')
    for(const path of [...referenced].sort()) {
        const source=files.get(path)
        lines.push(`- \`${path}\`：${source?.upstream?.url?`[固定上游](${source.upstream.url})，${source.status==='unchanged'?'与基线一致':'存在本地差异'}`:source?.provenance==='own-confirmed'?'已登记自有实现':'无固定上游对应，来源待核实'}。`)
        for(const note of source?.localNotes??[])lines.push(`  - ${note}`)
    }
    if(referenceIds.size) {
        lines.push('','## 未接入的社区参考','')
        for(const row of chain.referenceSources.filter(row=>referenceIds.has(row.id)))
            lines.push(`- [${row.path}](${row.repository}/blob/${row.commit}/${row.path}#L${row.line})：${row.detail}`)
    }
    return lines.join('\n')+'\n'
}

export const renderFilterCommon = (common,sourceFiles) => {
    const byPath=new Map(sourceFiles.map(row=>[row.path,row]))
    const lines=['# 过滤共用登记','','视频、评论、动态、专栏共用下列事实；不为每类对象重复保存。','',
        '## 独立判断契约','',`- ${common.decisionContract.detail}`,'','## 共用能力','']
    const append = row => {
        lines.push(`- **${row.label}**：${row.detail}`)
        for(const ref of row.refs) {
            const upstream=byPath.get(ref.path)?.upstream
            lines.push(`  - \`${ref.path}:${ref.line}\`${upstream?.url?`；[固定上游](${upstream.url})`:'；来源见维护索引'}。`)
        }
    }
    common.shared.forEach(append)
    lines.push('','## 当前共用判断实现（可替换）','')
    append(common.strategyCore)
    return lines.join('\n')+'\n'
}
