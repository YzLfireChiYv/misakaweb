import assert from 'node:assert/strict'
import { md5 } from '../src/utils/md5.ts'
import { exportRulePack, planRuleImport } from '../src/modules/filters/rulePack.ts'
import { ratePercent, round1 } from '../src/modules/filters/variety/video/statRate.ts'
import { classifyWebdavStatus, webdavProbeText } from '../src/modules/filters/webdavProbe.ts'

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

assert.equal(ratePercent(15, 1000), 1.5)
assert.equal(ratePercent(1, 3), 33.3)
assert.equal(ratePercent(2, 3), 66.7)
assert.equal(ratePercent(0, 10), 0)
assert.equal(ratePercent(5, 0), null)
assert.equal(ratePercent(1, -1), null)
assert.equal(round1(1.26), 1.3)
assert.equal(round1(2), 2)

assert.equal(classifyWebdavStatus(207, 'PROPFIND'), 'ok')
assert.equal(classifyWebdavStatus(401, 'PROPFIND'), 'auth')
assert.equal(classifyWebdavStatus(404, 'PROPFIND'), 'missing')
assert.equal(classifyWebdavStatus(405, 'PROPFIND'), 'fallback')
assert.equal(classifyWebdavStatus(404, 'GET'), 'ok')
assert.equal(classifyWebdavStatus(500, 'GET'), 'fail')
assert.equal(webdavProbeText('ok'), '已连通')
assert.equal(webdavProbeText('missing'), '目录不存在')
assert.equal(webdavProbeText('fail', 500), '没有连上（500）')

const ratePack = exportRulePack((key) => (key === 'biliweb-stat-like-rate-min' ? 1.5 : undefined))
assert.deepEqual(ratePack, { lr: 1.5 })
const rateWrites = planRuleImport({ fr: 2.5 }, () => undefined)
assert.ok(rateWrites)
assert.deepEqual(rateWrites, [{ gm: 'biliweb-stat-fav-rate-min', value: 2.5 }])

console.log('experience checks ok')
