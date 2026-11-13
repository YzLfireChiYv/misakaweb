/** Review-only catalog. Reads declarations as syntax; never runs website modules or GM APIs. */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { buildIndex } from './maintenance-index.mjs'
import { buildRelations, filterCatalog, upstreamImpact } from './catalog-relations.mjs'
import { buildFilterCommon, buildObjectChains, buildVideoChain, chainForControls, renderFilterChain, renderFilterCommon } from './catalog-chains.mjs'
import { buildProjectCoverage, coverageForPath, renderCoverage } from './catalog-coverage.mjs'
import {
    isMainModule, loadOccurrences, productRootFromScript, resolveSpecifier,
    sha256Normalized, stableStringify,
} from './maintenance-lib.mjs'

const ROOT = productRootFromScript(import.meta.url)
const OUTPUT = 'catalog/registry.generated.json'
const UNKNOWN = Symbol('unresolved syntax')
const TYPES = new Set(['switch', 'number', 'string', 'list', 'editor', 'webdav'])
const prop = (node, name) => node?.properties?.find(p =>
    (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
    p.name.getText().replace(/^['"]|['"]$/g, '') === name)
const expr = property => property && (ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer)
const unwrap = node => {
    while (node && (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression
    return node
}
const vueSyntax = text => {
    let cursor=0,result=''
    const padding=part=>part.replace(/[^\r\n]/g,' ')
    for(const match of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
        const start=match.index+match[0].indexOf('>')+1
        result+=padding(text.slice(cursor,start))+match[1]
        cursor=start+match[1].length
    }
    return result+padding(text.slice(cursor))
}

/** Resolve only literal data and local arrow-function Item factories; no eval/import execution. */
export const syntaxReader = root => {
    const files = new Map(), resolving = new Set()
    const file = rel => {
        if (files.has(rel)) return files.get(rel)
        const text = fs.readFileSync(path.join(root, rel), 'utf8')
        const syntaxText = rel.endsWith('.vue') ? vueSyntax(text) : text
        const sf = ts.createSourceFile(rel, syntaxText, ts.ScriptTarget.Latest, true)
        const record = { sf, text, variables: new Map(), imports: new Map() }
        files.set(rel, record)
        for (const statement of sf.statements) {
            if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations)
                if (ts.isIdentifier(declaration.name)) record.variables.set(declaration.name.text, declaration.initializer)
            if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
                const bindings = statement.importClause?.namedBindings
                if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements)
                    record.imports.set(binding.name.text, { specifier: statement.moduleSpecifier.text, name: binding.propertyName?.text ?? binding.name.text })
            }
        }
        return record
    }
    const value = (node, rel, parameters = {}) => {
        node = unwrap(node)
        if (!node) return undefined
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
        if (ts.isNumericLiteral(node)) return Number(node.text)
        if (node.kind === ts.SyntaxKind.TrueKeyword) return true
        if (node.kind === ts.SyntaxKind.FalseKeyword) return false
        if (node.kind === ts.SyntaxKind.NullKeyword) return null
        if (ts.isIdentifier(node)) {
            if (Object.hasOwn(parameters, node.text)) return parameters[node.text]
            if (node.text === 'undefined') return undefined
            const token = rel + ':' + node.text
            if (resolving.has(token)) return UNKNOWN
            resolving.add(token)
            try {
                const record = file(rel)
                if (record.variables.has(node.text)) return value(record.variables.get(node.text), rel, parameters)
                const imported = record.imports.get(node.text)
                if (imported) {
                    const resolved = resolveSpecifier(root, rel, imported.specifier)
                    if (resolved.kind === 'internal' && file(resolved.path).variables.has(imported.name))
                        return value(file(resolved.path).variables.get(imported.name), resolved.path)
                }
                return UNKNOWN
            } finally { resolving.delete(token) }
        }
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
            file(rel).imports.get(node.expression.text)?.name === 'settingDefault') {
            // Product decisions are attached separately from the original declaration.
            return value(node.arguments[1], rel, parameters)
        }
        if (ts.isPropertyAccessExpression(node)) {
            const object = value(node.expression, rel, parameters)
            return object === UNKNOWN ? UNKNOWN : object?.[node.name.text]
        }
        if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
            const operand = value(node.operand, rel, parameters)
            return typeof operand === 'number' ? -operand : UNKNOWN
        }
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
            const left = value(node.left, rel, parameters)
            return left === UNKNOWN ? UNKNOWN : left ?? value(node.right, rel, parameters)
        }
        if (ts.isArrayLiteralExpression(node)) {
            const array = node.elements.map(element => value(element, rel, parameters))
            return array.includes(UNKNOWN) ? UNKNOWN : array
        }
        if (ts.isObjectLiteralExpression(node)) {
            const object = {}
            for (const property of node.properties) {
                if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) return UNKNOWN
                const name = property.name.getText().replace(/^['"]|['"]$/g, '')
                const result = value(expr(property), rel, parameters)
                if (result === UNKNOWN) return UNKNOWN
                object[name] = result
            }
            return object
        }
        return UNKNOWN
    }
    const field = (object, name, rel, parameters) => {
        const property = prop(object, name)
        if (!property) return { state: 'not-declared' }
        const node = expr(property), result = value(node, rel, parameters)
        if (result === UNKNOWN) return { state: 'unresolved', expression: node.getText() }
        return result === undefined ? { state: 'undefined' } : { state: 'literal', value: result }
    }
    const item = (object, rel, parameters = {}, location = object, factories = []) => {
        const type = value(expr(prop(object, 'type')), rel, parameters)
        const key = value(expr(prop(object, 'id')), rel, parameters)
        if (!TYPES.has(type) || typeof key !== 'string') return null
        const declaration = {
            id: `${rel}:${file(rel).sf.getLineAndCharacterOfPosition(location.getStart()).line + 1}:${key}`,
            key, type, path: rel, line: file(rel).sf.getLineAndCharacterOfPosition(location.getStart()).line + 1,
            declaredDefault: field(object, type === 'switch' ? 'defaultEnable' : 'defaultValue', rel, parameters),
            constraints: {}, factories,
        }
        for (const name of ['minValue', 'maxValue', 'step', 'decimals', 'disableValue', 'applyDisabledValue']) {
            const result = field(object, name, rel, parameters)
            if (result.state !== 'not-declared') declaration.constraints[name] = result
        }
        declaration.styleBinding={mode:value(expr(prop(object,'noStyle')),rel,parameters)===true?'none':'attribute',
            attribute:prop(object,'attrName')?field(object,'attrName',rel,parameters):{state:'literal',value:key}}
        if(declaration.styleBinding.attribute.state==='unresolved') {
            const names=[]
            const visit=node=>{
                if(ts.isReturnStatement(node)&&node.expression&&ts.isStringLiteral(node.expression))names.push(node.expression.text)
                ts.forEachChild(node,visit)
            }
            visit(expr(prop(object,'attrName')))
            if(names.length)declaration.styleBinding.returnedAttributes=unique(names)
        }
        const sf=file(rel).sf
        const callback = (name,property) => {
            const operations=[]
            const visit=node=>{
                if(ts.isCallExpression(node)||ts.isNewExpression(node)) {
                    const target=node.expression.getText(sf)
                    if(/(?:^|\.)(?:querySelector(?:All)?|closest|getElementById|addEventListener|removeEventListener|setAttribute|removeAttribute|setProperty|removeProperty|setInterval|clearInterval|setTimeout|clearTimeout|MutationObserver|observe|disconnect|click|writeText|addPreFn|addPostFn|defineProperty|replaceState|pushState|GM_getValue|GM_setValue|playerGoTo|addShadowStyle|removeShadowStyle|enable|disable|setParam|checkFull)$/.test(target)) {
                        operations.push({call:target,line:sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1,
                            literals:(node.arguments??[]).slice(0,2).flatMap(argument=>ts.isStringLiteral(argument)||ts.isNoSubstitutionTemplateLiteral(argument)?[argument.text]:[])})
                    }
                }
                ts.forEachChild(node,visit)
            }
            visit(expr(property))
            return {name,line:sf.getLineAndCharacterOfPosition(property.getStart(sf)).line+1,
                endLine:sf.getLineAndCharacterOfPosition(property.end-1).line+1,operations}
        }
        declaration.callbacks=['enableFn','disableFn','fn','saveFn','onEdit','verify'].flatMap(name=>{
            const property=prop(object,name)
            return property?[callback(name,property)]:[]
        })
        declaration.enableTiming=field(object,'enableFnRunAt',rel,parameters)
        if (type === 'list') {
            const options = unwrap(expr(prop(object, 'options')))
            declaration.options = options && ts.isArrayLiteralExpression(options) ? options.elements.map(option => ({
                value: field(option, 'value', rel, parameters), name: field(option, 'name', rel, parameters),
            })) : []
            if(options&&ts.isArrayLiteralExpression(options))for(const option of options.elements) {
                const fn=prop(option,'fn')
                if(fn)declaration.callbacks.push({...callback('option.fn',fn),option:field(option,'value',rel,parameters)})
            }
        }
        if (type === 'webdav') declaration.fields = Object.fromEntries(['urlId','userId','passwordId'].map(name => [name, value(expr(prop(object,name)),rel,parameters)]))
        if (type === 'switch' && ['not-declared','undefined'].includes(declaration.declaredDefault.state))
            declaration.configurationDefault = { state: 'known', value: false, basis: 'missing defaultEnable is falsy; does not persist false' }
        else if (type === 'editor') declaration.configurationDefault = { state: 'known', value: [], basis: 'configuration registry editor fallback; individual filter reads remain implementation details' }
        else if (declaration.declaredDefault.state === 'literal') declaration.configurationDefault = { state: 'known', value: declaration.declaredDefault.value, basis: 'declared default' }
        else declaration.configurationDefault = { state: type === 'webdav' ? 'not-a-storage-key' : 'unresolved' }
        return declaration
    }
    const factory = (call, rel, parameters = {}, location = call, chain = []) => {
        if (!ts.isIdentifier(call.expression) || chain.includes(call.expression.text)) return null
        const fn = unwrap(file(rel).variables.get(call.expression.text))
        if (!fn || !ts.isArrowFunction(fn)) return null
        const bindings = Object.fromEntries(fn.parameters.filter(p => ts.isIdentifier(p.name)).map((p, i) =>
            [p.name.text, call.arguments[i] ? value(call.arguments[i], rel, parameters) : undefined]))
        const body = unwrap(fn.body)
        if (ts.isObjectLiteralExpression(body)) return item(body, rel, bindings, location, [...chain,call.expression.text])
        if (ts.isCallExpression(body)) return factory(body,rel,bindings,location,[...chain,call.expression.text])
        return null
    }
    const declarations = rel => {
        const rows = new Map()
        const visit = node => {
            const row = ts.isObjectLiteralExpression(node) ? item(node,rel)
                : ts.isCallExpression(node) ? factory(node,rel) : null
            if (row) rows.set(row.id,row)
            ts.forEachChild(node,visit)
        }
        visit(file(rel).sf)
        return [...rows.values()]
    }
    const readFallbacks = rel => {
        const rows=[],record=file(rel)
        const visit=node=>{
            if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)) {
                const name=record.imports.get(node.expression.text)?.name??node.expression.text
                if(['GM_getValue','useGMValue','readSettingValue'].includes(name)) {
                    const key=value(node.arguments[0],rel)
                    const fallback=node.arguments.length<2?{state:'not-provided'}:(()=>{
                        const result=value(node.arguments[1],rel)
                        return result===UNKNOWN?{state:'unresolved',expression:node.arguments[1].getText()}
                            :result===undefined?{state:'undefined'}:{state:'literal',value:result}
                    })()
                    rows.push({path:rel,line:record.sf.getLineAndCharacterOfPosition(node.getStart()).line+1,reader:name,
                        key:typeof key==='string'?key:null,keyExpression:node.arguments[0]?.getText()??'',fallback})
                }
            }
            ts.forEachChild(node,visit)
        }
        visit(record.sf)
        return rows
    }
    return { file, value, declarations, readFallbacks, usedFiles: () => [...files.keys()], unknown: UNKNOWN }
}

const read = (root, rel) => JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'))
const signature = value => JSON.stringify(value)
const unique = values => [...new Set(values)].sort()

export async function buildCatalog({ root = ROOT, index: providedIndex, occurrences: providedOccurrences } = {}) {
    const index = providedIndex ?? await buildIndex({root})
    const occurrences = providedOccurrences ?? await loadOccurrences(root)
    const seed = read(root,'catalog/feature-groups.json')
    const decisions = read(root,'catalog/default-decisions.json')
    const controlMap = read(root,'src/feedback/control-map.json')
    const taxonomy = read(root,'catalog/tags.json')
    const coverageSeed='catalog/project-coverage.json', baselineSeed='catalog/upstream-coverage-seed.json'
    const projectSeed=read(root,coverageSeed), baseline=read(root,baselineSeed)
    const profiles = read(root,'config/build-profiles.json')
    const reviewText = fs.readFileSync(path.join(root,'src/feedback/review-catalog.generated.ts'),'utf8')
    const review = JSON.parse(reviewText.match(/export const reviewCatalog: ReviewEntry\[\] = (\[[\s\S]*\])\s*$/)[1])
    const reader = syntaxReader(root), issues = []
    const featureIds = new Set(), controlKeys = new Set(controlMap.settings.map(row=>row.key))
    for (const feature of seed.features) {
        if (featureIds.has(feature.id)) throw new Error(`duplicate feature: ${feature.id}`)
        featureIds.add(feature.id)
        for (const key of feature.settingKeys) if (!controlKeys.has(key)) issues.push({kind:'historical-setting-not-in-product',feature:feature.id,key})
    }
    const featuresFor = key => seed.features.filter(feature=>feature.settingKeys.includes(key)).map(feature=>feature.id).sort()
    const relationFor = key => occurrences.filter(row=>row.id===key).map(row=>({
        path:'src/modules/'+row.file, pages:row.pages, panel:row.panel, group:row.group,
    }))
    const declarationFiles = unique(occurrences.map(row=>'src/modules/'+row.file))
    const declarations = declarationFiles.flatMap(rel=>reader.declarations(rel))
    for (const declaration of declarations) declaration.contexts=relationFor(declaration.key)
        .filter(row=>row.path===declaration.path).map(({pages,panel,group})=>({pages,panel,group}))
    const ruleFields = reader.value(reader.file('src/modules/filters/rulePack.ts').variables.get('RULE_FIELDS'),'src/modules/filters/rulePack.ts')
    if (!Array.isArray(ruleFields)) throw new Error('RULE_FIELDS could not be read as literal data')
    const ruleKeys = new Set(ruleFields.map(row=>row.gm))
    const configurations = new Map()
    const add = (storage,key,entry) => {
        const id=storage+':'+key
        let record=configurations.get(id)
        if (!record) {
            record={id,storage,key,controlIds:[],featureIds:[],declarationIds:[],configurationDefaults:[],scope:ruleKeys.has(key)?'rules':key==='biliweb-sync-enabled'?'device':'settings',productDefaults:[],effectiveDefaultStatus:'not-derived'}
            configurations.set(id,record)
        }
        if(entry) Object.assign(record,entry)
        return record
    }
    const controls=controlMap.settings.map(control=>{
        const relation=relationFor(control.key)
        const declarationRows=declarations.filter(row=>row.key===control.key||
            (control.type==='webdav-field'&&Object.values(row.fields??{}).includes(control.key)))
        const featureIds=featuresFor(control.key)
        if(!featureIds.length) issues.push({kind:'feature-group-unassigned',key:control.key})
        const classification=review.find(row=>row.key===control.key)
        const pack=classification?.pack ?? null
        const editions=control.retired?[]:['development',...profiles.profiles.filter(profile=>!pack||profile.packs.includes(pack)).map(profile=>profile.id)]
        let configuration=null
        if(control.type!=='webdav') {
            const binding=control.storage
            configuration=add('gm',binding?.key??control.key)
            configuration.kind=control.type==='editor'?'lines':control.type==='list'?'choice':control.type==='webdav-field'?'string':control.type
            configuration.controlIds.push(control.id)
            configuration.featureIds=unique([...configuration.featureIds,...featureIds])
            if(binding?.scope)configuration.scope=binding.scope
            if(control.type==='editor'&&control.panels.some(panel=>panel.includes('filter')))configuration.scope='rules'
            if(control.type==='webdav-field')configuration.scope='secrets'
            for(const row of declarationRows) {
                configuration.declarationIds.push(row.id)
                configuration.configurationDefaults.push({declarationId:row.id,...row.configurationDefault})
            }
        }
        if(!control.retired&&!declarationRows.length&&!control.storage&&control.type!=='webdav-field')issues.push({kind:'declaration-unresolved',key:control.key})
        return {id:control.id,key:control.key,type:control.type,names:control.names,featureIds,retired:control.retired??false,
            configurationId:configuration?.id??null,...(control.storage?.field?{field:control.storage.field}:{}),
            category:classification?.category??(control.key.startsWith('biliweb-sync-')?'support':control.panels.some(panel=>panel.includes('filter'))?'filtering':'support'),
            pack,capabilityEditions:editions,relations:relation,declarationIds:declarationRows.map(row=>row.id)}
    })
    // Read the four explicit supplemental definitions already used by the backup registry.
    const supplementalPath='src/modules/configuration/registry.ts'
    const supplemental=reader.file(supplementalPath)
    const visit=node=>{
        if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='add') {
            const object=unwrap(node.arguments[0])
            const data=Object.fromEntries(['key','storage','scope','kind','defaults'].map(name=>
                [name,reader.value(expr(prop(object,name)),supplementalPath)]))
            if(typeof data.key==='string'&&['gm','local'].includes(data.storage)&&Array.isArray(data.defaults)) {
                const record=add(data.storage,data.key)
                record.scope=data.scope
                record.kind=data.kind
                record.configurationDefaults=data.defaults.map(({context,value})=>({state:'known',value,context,basis:'explicit configuration registry definition',path:supplementalPath}))
            }
        }
        ts.forEachChild(node,visit)
    }
    visit(supplemental.sf)
    for(const field of ruleFields) {
        const record=add('gm',field.gm)
        record.ruleAbsentDefault={value:field.absent,path:'src/modules/filters/rulePack.ts',basis:'rule-pack absence/omission fallback; does not override declarations'}
        if(!record.configurationDefaults.length)record.configurationDefaults.push({state:'known',value:field.absent,basis:'RULE_FIELDS absent fallback',path:'src/modules/filters/rulePack.ts'})
    }
    for(const control of controls.filter(row=>row.type==='webdav-field')) {
        const record=configurations.get(control.configurationId)
        record.configurationDefaults=[{state:'known',value:'',basis:'configuration registry connection-field fallback',path:supplementalPath}]
    }
    const decisionTargets=new Set()
    for(const decision of decisions.decisions) {
        const id='gm:'+decision.key, token=id+':'+(decision.field??'')
        const record=configurations.get(id)
        if(!record)throw new Error(`unknown default decision: ${decision.key}`)
        if(!['confirmed','candidate','undecided'].includes(decision.status))throw new Error(`invalid default status: ${decision.key}`)
        if(decision.status!=='undecided'&&!Object.hasOwn(decision,'value'))throw new Error(`missing default value: ${decision.key}`)
        if(decisionTargets.has(token))throw new Error(`duplicate default decision: ${token}`)
        decisionTargets.add(token)
        record.productDefaults.push(decision)
    }
    const readSites=index.files.filter(row=>/\.(ts|vue)$/.test(row.path)&&!row.path.includes('/feedback/'))
        .flatMap(row=>reader.readFallbacks(row.path))
    for(const record of configurations.values()) {
        record.controlIds=unique(record.controlIds)
        record.declarationIds=unique(record.declarationIds)
        const linked=controls.filter(row=>row.configurationId===record.id)
        record.registrationEditions=unique(linked.flatMap(row=>row.capabilityEditions))
        if(!linked.length)record.registrationEditions=['development','pure','desktop-toolkit']
        record.productDefaultStatus=record.productDefaults.some(row=>row.status==='confirmed'&&!row.field)?'confirmed'
            :record.productDefaults.some(row=>row.status==='confirmed')?'partially-confirmed'
            :record.productDefaults.some(row=>row.status==='candidate')?'candidate':'unreviewed'
        if (record.productDefaultStatus === 'confirmed' || record.productDefaultStatus === 'partially-confirmed')
            record.effectiveDefaultStatus='confirmed-override'
        const references=linked.flatMap(control=>index.settings.find(row=>row.id===control.id)?.occurrences.map(row=>row.path)??[])
        record.sourcePaths=unique([...references,...declarations.filter(row=>record.declarationIds.includes(row.id)).map(row=>row.path),
            ...record.configurationDefaults.map(row=>row.path).filter(Boolean)])
        const known=record.configurationDefaults.filter(row=>row.state==='known')
        record.readFallbacks=readSites.filter(row=>record.storage==='gm'&&row.key===record.key)
        record.readFallbackDifference=record.readFallbacks.some(row=>row.fallback.state==='literal'&&known.length&&
            !known.some(defaultValue=>signature(defaultValue.value)===signature(row.fallback.value)))
        if(record.readFallbackDifference)issues.push({kind:'read-fallback-differs-from-declaration',configurationId:record.id})
        record.sourcePaths=unique([...record.sourcePaths,...record.readFallbacks.map(row=>row.path),...(record.ruleAbsentDefault?[record.ruleAbsentDefault.path]:[])])
        record.declarationDefaultConflict=new Set(known.map(row=>signature(row.value))).size>1
        if(record.declarationDefaultConflict)issues.push({kind:'context-default-conflict',configurationId:record.id})
        if(!record.configurationDefaults.length&&record.registrationEditions.length)issues.push({kind:'configuration-default-unresolved',configurationId:record.id})
        for(const unresolved of record.configurationDefaults.filter(row=>row.state==='unresolved'))
            issues.push({kind:'configuration-default-unresolved',configurationId:record.id,declarationId:unresolved.declarationId})
        for(const decision of record.productDefaults) {
            if(decision.status==='undecided')continue
            const sample=known.map(row=>decision.field?row.value?.[decision.field]:row.value).find(value=>value!==undefined)
            if(sample!==undefined&&(Array.isArray(sample)?!Array.isArray(decision.value):typeof sample!==typeof decision.value))
                throw new Error(`default decision value type differs from code: ${record.key}`)
            const options=declarations.filter(row=>record.declarationIds.includes(row.id)).flatMap(row=>row.options??[])
                .filter(option=>option.value.state==='literal').map(option=>option.value.value)
            if(options.length&&!options.includes(decision.value))throw new Error(`unknown default option: ${record.key}`)
            if(decision.status==='confirmed'&&known.some(row=>signature(decision.field?row.value?.[decision.field]:row.value)!==signature(decision.value)))
                issues.push({kind:'product-default-differs-from-code',configurationId:record.id,resolution:'runtime-override',...(decision.field?{field:decision.field}:{})})
        }
    }
    const features=[...seed.features,...projectSeed.localFeatureGroups.map(row=>({id:row.id,label:row.label,description:row.description,
        settingKeys:[],groupingStatus:'current-product-group',evidence:'本地实现'}))].map(feature=>({...feature,dependencyReviewStatus:'not-reviewed',conflictReviewStatus:'not-reviewed',
        controlIds:controls.filter(row=>row.featureIds.includes(feature.id)).map(row=>row.id)}))
    const actions=['menus','actions'].flatMap(kind=>controlMap[kind].map(row=>({id:row.id,key:row.key,name:row.name,
        pages:row.pages,panel:row.panel,kind,retired:row.retired??false,featureMappingStatus:'not-reviewed'})))
    const relations=buildRelations({index,controls,configurations:[...configurations.values()],declarations,features,actions,controlMap,taxonomy,decisions})
    const chainSeed='catalog/video-filter-chain.json'
    const commonSeed='catalog/filter-common.json', objectSeed='catalog/object-filter-chains.json'
    const filterChainCommon=buildFilterCommon(read(root,commonSeed),reader,relations.sourceFiles)
    const chainInputs={reader,declarations,controls,sourceFiles:relations.sourceFiles,common:filterChainCommon}
    const videoChain=buildVideoChain({...chainInputs,seed:read(root,chainSeed)})
    const otherChains=buildObjectChains({...chainInputs,seed:read(root,objectSeed)})
    const catalog={features,controls,configurations:[...configurations.values()],declarations,actions,...relations,
        filterChainCommon,implementationChains:[videoChain,...otherChains],sources:index.sources}
    const coverage=buildProjectCoverage({root,seed:projectSeed,baseline,catalog,reader})
    const inputs=unique(['catalog/feature-groups.json','catalog/default-decisions.json','catalog/tags.json',chainSeed,commonSeed,objectSeed,coverageSeed,baselineSeed,'src/feedback/control-map.json','src/feedback/review-catalog.generated.ts','config/build-profiles.json','maintenance/registry.json',...index.files.map(row=>row.path),...reader.usedFiles()])
    return {
        schemaVersion:5,purpose:'review registry; no runtime application, user settings or sync protocol',
        policy:decisions.policy,upstreamInventory:seed.upstreamInventory,sources:index.sources,
        productDecisions:decisions.capabilities??[],supersededDecisions:decisions.supersededDecisions??[],
        inputs:inputs.map(rel=>({path:rel,sha256:sha256Normalized(fs.readFileSync(path.join(root,rel),'utf8'))})),
        features,controls,configurations:[...configurations.values()].sort((a,b)=>a.id.localeCompare(b.id)),...relations,
        filterChainCommon,implementationChains:[videoChain,...otherChains],coverage,
        readSiteLimitations:{scope:'Literal fallback arguments only; outer normalization, initialisation order and dynamic keys are not evaluated.',
            dynamicKeySites:readSites.filter(row=>row.key===null)},
        declarations:declarations.sort((a,b)=>a.id.localeCompare(b.id)),
        actions,
        issues,counts:{features:features.length,controls:controls.length,configurations:configurations.size,declarations:declarations.length,
            confirmedDefaults:decisions.decisions.filter(row=>row.status==='confirmed').length,unreviewedDefaults:[...configurations.values()].filter(row=>row.productDefaultStatus==='unreviewed').length,
            declarationDefaultConflicts:issues.filter(row=>row.kind==='context-default-conflict').length,
            readFallbackDifferences:issues.filter(row=>row.kind==='read-fallback-differs-from-declaration').length,
            unresolvedDeclarations:issues.filter(row=>row.kind==='declaration-unresolved').length},
    }
}

export const findCatalog = (catalog,query) => {
    const matching=catalog.controls.filter(row=>row.id===query||row.key===query||row.featureIds.includes(query))
    const actions=catalog.actions.filter(row=>row.id===query||row.key===query||row.featureIds.includes(query))
    const formDeclarations=new Set(matching.filter(row=>row.type==='webdav').flatMap(row=>row.declarationIds))
    const formKeys=new Set(catalog.declarations.filter(row=>formDeclarations.has(row.id)).flatMap(row=>Object.values(row.fields??{})))
    const configurations=catalog.configurations.filter(row=>row.id===query||row.key===query||formKeys.has(row.key)||matching.some(control=>control.configurationId===row.id))
    const controls=catalog.controls.filter(row=>matching.includes(row)||configurations.some(config=>config.controlIds.includes(row.id)))
    const featureIds=new Set([...controls.flatMap(row=>row.featureIds),...actions.flatMap(row=>row.featureIds),...configurations.flatMap(row=>row.featureIds),query])
    const paths=new Set([...configurations.flatMap(row=>row.sourcePaths),...[...controls,...actions].flatMap(row=>row.locations.map(loc=>loc.path))])
    const implemented=(catalog.coverage?.declarations??[]).filter(row=>controls.some(control=>control.declarationIds.includes(row.id))||featureIds.has(query)&&row.featureIds.includes(query))
    const controlCoverage=(catalog.coverage?.controls??[]).filter(row=>controls.some(control=>control.id===row.id))
    const behavior=(catalog.coverage?.actions??[]).filter(row=>actions.some(action=>action.id===row.id)||row.featureIds.includes(query))
    const coverageFeatures=(catalog.coverage?.features??[]).filter(row=>featureIds.has(row.id))
    const coverageEntries=(catalog.coverage?.entries??[]).filter(row=>coverageFeatures.some(feature=>feature.entryIds.includes(row.id))||
        [...implemented,...behavior].some(item=>item.common.includes(row.id)))
    for(const file of [...implemented.flatMap(row=>[row.path,...[...row.css,...row.refs].map(ref=>ref.path)]),...behavior.flatMap(row=>row.refs.map(ref=>ref.path)),
        ...coverageFeatures.flatMap(row=>row.paths),...coverageEntries.flatMap(row=>row.refs.map(ref=>ref.path))])paths.add(file)
    return {features:catalog.features.filter(row=>featureIds.has(row.id)),controls,actions,configurations,sourceFiles:catalog.sourceFiles.filter(row=>paths.has(row.path)),
        implementationChains:chainForControls(catalog,controls.map(row=>row.id)),coverage:{controls:controlCoverage,declarations:implemented,actions:behavior,
            features:coverageFeatures,entries:coverageEntries},
        declarations:catalog.declarations.filter(row=>controls.some(control=>control.declarationIds.includes(row.id))||configurations.some(config=>config.declarationIds.includes(row.id)))}
}

export const catalogReview = catalog => {
    const share=findCatalog(catalog,'gm:video-page-simple-share')
    const home=upstreamImpact(catalog,['cleaner:src/modules/rules/homepage/groups/basic.scss'],{limit:8})
    const touch=upstreamImpact(catalog,['evolved:registry/lib/components/touch/player-gestures/swiper.ts'],{limit:8})
    const lines=['# 功能与配置登记审阅摘要','','此摘要由登记数据生成；产品默认仍未应用到运行配置。',
        '',`- 功能分组记录：${catalog.counts.features}；历史分组是待复核参考，不能等同于已确认的最终产品功能数。`,
        `- 设置控件：${catalog.counts.controls}；实际配置键：${catalog.counts.configurations}；源码声明：${catalog.counts.declarations}。`,
        `- 有依据的默认决定：${catalog.counts.confirmedDefaults}（含字段级决定）；未审阅配置：${catalog.counts.unreviewedDefaults}。`,
        `- ${catalog.controls.length}个设置控件和${catalog.actions.length}个菜单/动作均带可检索标签；来源或实现不明确的保留待核实。`,
        '', '## 产品范围决定','',
        ...catalog.productDecisions.map(row=>`- ${row.keys.join('、')}：${row.reason}（依据：${row.evidence}）`),
        '', '## 已确认的默认决定','']
    for (const config of catalog.configurations) for (const decision of config.productDefaults.filter(row=>row.status==='confirmed')) {
        lines.push(`- \`${config.id}${decision.field?'.'+decision.field:''}\`：\`${JSON.stringify(decision.value)}\`。${decision.reason}`)
        lines.push(`  - 依据：${decision.evidence}`)
    }
    lines.push('','## 跨页面声明差异','')
    for(const config of catalog.configurations.filter(row=>row.declarationDefaultConflict)) {
        lines.push(`- \`${config.id}\`：${config.effectiveDefaultStatus==='confirmed-override'?'缺键时由统一读取应用已确认的产品默认。':'保留各页面声明，产品默认待审。'}`)
        for(const fallback of config.configurationDefaults) lines.push(`  - \`${fallback.declarationId??fallback.path}\`：\`${JSON.stringify(fallback.value)}\``)
    }
    lines.push('','## 声明与读取回退需要联查','',
        '这里只记录读取调用的回退参数；初始化顺序、外层归一化和动态键未推算，不能将其中某个值当成最终运行默认。','')
    for(const config of catalog.configurations.filter(row=>row.readFallbackDifference)) {
        lines.push(`- \`${config.id}\`：声明/备份登记缺省 ${[...new Set(config.configurationDefaults.filter(row=>row.state==='known').map(row=>JSON.stringify(row.value)))].join(' / ')}。`)
        for(const site of config.readFallbacks.filter(row=>row.fallback.state==='literal'))
            lines.push(`  - \`${site.path}:${site.line}\` ${site.reader} 回退：\`${JSON.stringify(site.fallback.value)}\`。`)
    }
    lines.push('','## 本轮保留的待定边界','',
        '- 历史候选预设保留证据引用，未复制个人设置或套用到新增项目。',
        '- 原始分组、功能依赖/冲突、动作与功能关系继续待复核；静态import不等于运行依赖。',
        '- 来源信息沿用现有维护登记；文件对应不证明全部函数的作者或网页研究来源。',
        '- 版本可用范围从当前构建配置推导，不代表每版已实际运行验收。',
        '- 默认升级、未来同步路由及最终产品形态继续按需求讨论；本轮未实现。',
        '', '## 三个审阅样例','',
        `- **按标签筛选**：净化＋布局收尾命中 ${filterCatalog(catalog,['purpose=cleaning','role=finish']).entries.map(row=>`${row.id} ${row.name}`).join('、')}。这里是已有明确证据的两处收尾样例，未据此给所有布局项贴同样标签。`,
        `- **由配置定位实现**：分享净化共用一个保存键，定位到 ${unique(share.declarations.map(row=>row.path)).map(file=>`\`${file}\``).join('、')}。缺键时统一开启，原始声明保留供上游对照。`,
        `- **由上游文件反查**：首页基础样式对应 ${home.direct} 个直接关联项；Evolved swiper 对应触摸手势 ${touch.hits.filter(row=>row.relation==='direct').map(row=>row.id).join('、')}。装配检查点另列，结果用于定位检查范围。`,
        '', '## 对象过滤实现链','',
        `- 已按四步登记 ${catalog.implementationChains[0].pages.length} 个页面适配模块；[逐页审阅](VIDEO-FILTER.generated.md)。共用环节只登记一次，黑白名单只属于现行策略。`,
        '- 四类已接入独立判断，正式评分仍未实现。标签区分搜索响应复用与未接入的社区主动取数参考。',
        '- [评论](COMMENT-FILTER.generated.md)、[动态](DYNAMIC-FILTER.generated.md)、[专栏](ARTICLE-FILTER.generated.md)已登记；[共用登记](FILTER-COMMON.generated.md)单列。',
        '- 其余净化、优化、交互、存储和装配见[全量实现登记](COVERAGE.generated.md)，按实际执行方式记录。',
        '- 单页查询：`pnpm catalog --chain dynamic-filter header`。反查上游时额外显示命中的环节和现行策略。',
        '', '## 审阅入口','',
        '- 关系数据：registry.generated.json；产品决定：default-decisions.json；分组种子：feature-groups.json。',
        '- 筛选：`pnpm catalog --tag purpose=cleaning --tag role=finish`。',
        '- 定位：`pnpm catalog --find S502`、`pnpm catalog --find gm:biliweb-shortcut-entry`。',
        '- 反查：`pnpm catalog --upstream cleaner:src/modules/rules/homepage/groups/basic.scss`。',
        '- 确认数据与源码一致：`pnpm catalog --check`。提交和推送另行审阅。','')
    return lines.join('\n')
}

const lookup = args => {
    const catalog=read(ROOT,OUTPUT)
    if(catalog.schemaVersion!==5)throw new Error('请先用 pnpm catalog 生成当前登记')
    if(args[0]==='--coverage'&&args.length<=2) {
        if(args.length===1)return stableStringify({counts:catalog.coverage.counts,checks:catalog.coverage.checks})
        const file=coverageForPath(catalog.coverage,args[1])
        if(!file)throw new Error(`未登记的覆盖路径：${args[1]}`)
        return stableStringify(file)
    }
    if(args[0]==='--baseline'&&args.length===2) {
        const query=args[1],coverage=catalog.coverage
        const definitions=coverage.baselineDefinitions.filter(row=>row.id===query||row.key===query||row.featureId===query)
        const actions=coverage.baselineActions.filter(row=>row.id===query)
        const storage=coverage.baselineStorage.filter(row=>row.key===query)
        if(!definitions.length&&!actions.length&&!storage.length)throw new Error(`未找到上游盘点记录：${query}`)
        return stableStringify({source:coverage.source,definitions,actions,storage})
    }
    if(args[0]==='--tags'&&args.length===1)return stableStringify(catalog.tagVocabulary)
    if(args[0]==='--chain'&&(args.length===2||args.length===3)) {
        const chain=catalog.implementationChains?.find(row=>row.id===args[1])
        if(!chain)throw new Error(`未登记的实现链：${args[1]}`)
        return renderFilterChain(chain,catalog.filterChainCommon,catalog.sourceFiles,args[2])
    }
    if(args[0]==='--find'&&args.length===2) {
        const found=findCatalog(catalog,args[1])
        if(!found.features.length&&!found.controls.length&&!found.actions.length&&!found.configurations.length)throw new Error(`未找到：${args[1]}`)
        return stableStringify(found)
    }
    const values=[],page={limit:20,offset:0}
    let mode, json=false, comparison
    for(let i=0;i<args.length;i++) {
        const flag=args[i]
        if(flag==='--json'){json=true;continue}
        const value=args[++i]
        if(!value||value.startsWith('--'))throw new Error(`缺少参数：${flag}`)
        if(flag==='--limit'||flag==='--offset') {
            const number=Number(value)
            if(!Number.isSafeInteger(number)||number<(flag==='--limit'?1:0)||(flag==='--limit'&&number>100))throw new Error(`无效分页：${flag} ${value}`)
            page[flag.slice(2)]=number
        } else if(['--tag','--upstream','--compare'].includes(flag)&&(!mode||mode===flag)&&!(mode==='--compare')) {
            mode=flag
            if(flag==='--compare') {
                const file=args[++i]
                if(!file||file.startsWith('--'))throw new Error('--compare 需要来源ID和本地比较JSON路径')
                const compare=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'))
                if(!Array.isArray(compare.files)||!compare.files.length)throw new Error('比较JSON缺少文件变化列表')
                for(const row of compare.files)for(const name of [row.filename,row.previous_filename].filter(Boolean))values.push(`${value}:${name}`)
                comparison={source:value,base:compare.base_commit?.sha??null,fileCount:compare.files.length,
                    possiblyTruncated:compare.files.length>=300}
            } else values.push(value)
        } else throw new Error(`未知或冲突的参数：${flag}`)
    }
    if(!mode)throw new Error('请指定查询方式；用 --help 查看帮助')
    const result=mode==='--tag'?filterCatalog(catalog,values,page):upstreamImpact(catalog,values,page)
    if(comparison) {
        comparison.catalogBase=catalog.sources.find(row=>row.id===comparison.source)?.commit??null
        comparison.baseMatches=comparison.base!==null&&comparison.catalogBase===comparison.base
        result.comparison=comparison
    }
    if(json)return stableStringify(result)
    const lines=[`使用已生成登记：共 ${result.total} 条，显示 ${result.entries?.length??result.hits.length} 条（跳过 ${page.offset} 条）。`]
    if(mode==='--tag')for(const row of result.entries)
        lines.push(`${row.id} ${row.name??row.key}  ${row.configurationId??row.key}`)
    else {
        const mapped=result.changes.filter(row=>row.status==='mapped').length
        const repository=result.changes.filter(row=>row.status==='registered-only').length
        lines.push(`上游路径：${mapped} 已对应，${repository} 仅登记仓库去向，${result.changes.length-mapped-repository} 未对应。直接关联 ${result.direct} 条；其余为静态依赖候选。`)
        if(comparison&&!comparison.baseMatches)lines.push('比较起点与登记基线不一致或未知；结果只用于路径定位。')
        if(comparison?.possiblyTruncated)lines.push('比较文件列表达到 300 项，可能截断；未列出的路径不在本次检查范围。')
        for(const row of result.changes.slice(0,page.limit))lines.push(`${row.source}:${row.path} → ${row.localFiles.map(file=>file.path).join('、')||row.localPath||(row.status==='registered-only'?'上游仓库配套':'未登记')}`)
        if(result.changes.length>page.limit)lines.push('上游路径仅展示前若干条；--json 可查看完整输入映射。')
        for(const row of result.boundaries)lines.push(`装配检查点：${row.trail.join(' → ')}（${row.changed?'文件本身变更，需核对注册与入口':'到此停止扩散'}）`)
        for(const row of result.chainHits.slice(0,page.limit))lines.push(`实现链：${row.chain} / ${(row.chains??row.pages).join('、')} / ${row.label}（文件级关联）`)
        for(const row of result.hits)lines.push(`${row.id} ${row.name??row.key} [${row.relation==='direct'?'直接关联':'静态依赖'}] ${row.trail.join(' → ')}${row.localNotes.length?'（有本地改动说明）':''}`)
    }
    return lines.join('\n')
}

if(isMainModule(import.meta.url,process.argv[1])) {
    const args=process.argv.slice(2)
    const run=async()=>{
        if(args[0]==='--help'&&args.length===1) {
            console.log('pnpm catalog [--check | --coverage [路径] | --baseline 原盘点ID/键/功能ID | --tags | --find 编号/键/功能ID | --chain 过滤链ID [页面] | --tag 维度=标签 | --upstream 来源:路径 | --compare 来源 比较JSON]\n过滤链：video-filter、comment-filter、dynamic-filter、article-filter。筛选和反查支持 --limit 1..100、--offset N、--json。')
            return
        }
        if(args.length&&!(args.length===1&&args[0]==='--check')){console.log(lookup(args));return}
        const catalog=await buildCatalog()
        const text=stableStringify(catalog),dest=path.join(ROOT,OUTPUT)
        const summary=catalogReview(catalog),summaryPath=path.join(ROOT,'catalog/REVIEW.generated.md')
        const reports=catalog.implementationChains.map(chain=>[
            path.join(ROOT,`catalog/${chain.id.toUpperCase()}.generated.md`),renderFilterChain(chain,catalog.filterChainCommon,catalog.sourceFiles),
        ])
        reports.push([path.join(ROOT,'catalog/FILTER-COMMON.generated.md'),renderFilterCommon(catalog.filterChainCommon,catalog.sourceFiles)])
        reports.push([path.join(ROOT,'catalog/COVERAGE.generated.md'),renderCoverage(catalog.coverage)])
        if(args[0]==='--check') {
            if(!fs.existsSync(dest)||fs.readFileSync(dest,'utf8').replaceAll('\r\n','\n')!==text)throw new Error(`${OUTPUT} is stale`)
            if(!fs.existsSync(summaryPath)||fs.readFileSync(summaryPath,'utf8').replaceAll('\r\n','\n')!==summary)throw new Error('catalog/REVIEW.generated.md is stale')
            for(const [file,report]of reports)if(!fs.existsSync(file)||fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')!==report)
                throw new Error(`${path.basename(file)} is stale`)
            console.log('Catalog matches current sources.',catalog.counts);return
        }
        fs.writeFileSync(dest,text)
        fs.writeFileSync(summaryPath,summary)
        for(const [file,report]of reports)fs.writeFileSync(file,report)
        console.log('Wrote',OUTPUT,catalog.counts)
    }
    run().catch(error=>{console.error(error.message??error);process.exitCode=1})
}
