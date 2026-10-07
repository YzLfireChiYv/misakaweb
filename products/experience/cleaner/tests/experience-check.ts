import assert from 'node:assert/strict'
import { md5 } from '../src/utils/md5.ts'
import { exportRulePack, planRuleImport } from '../src/modules/filters/rulePack.ts'

assert.equal(md5(''), 'd41d8cd98f00b204e9800998ecf8427e')
assert.equal(md5('abc'), '900150983cd24fb0d6963f7d28e17f72')
assert.equal(md5('message digest'), 'f96b697d7cb7938d525a2f31aaf161d0')

const store = new Map<string, unknown>([
    ['global-title-keyword-filter-value', ['课文', '副业']],
    ['global-uploader-filter-value', []],
    ['global-duration-filter-value', 0],
    ['biliweb-stat-like-min', 100],
    ['search-relativity-threshold-value', 15],
])
const pack = exportRulePack((key) => store.get(key))
assert.deepEqual(pack, { tb: ['课文', '副业'], lk: 100 })

const writes = planRuleImport(
    { tb: ['课文'], lk: 80 },
    (key) => store.get(key),
)
assert.ok(writes)
assert.deepEqual(writes, [
    { gm: 'global-title-keyword-filter-value', value: ['课文'] },
    { gm: 'biliweb-stat-like-min', value: 80 },
])
assert.equal(planRuleImport({ nope: 1 }, () => undefined), null)
assert.equal(planRuleImport({ tb: [1] }, () => undefined), null)

console.log('experience checks ok')
