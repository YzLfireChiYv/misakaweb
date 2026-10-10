import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectMaintenanceDiagnostic } from '../src/modules/maintenance/diagnostics'
import { validateEvidence } from '../src/modules/maintenance/evidence'

afterEach(() => { vi.unstubAllGlobals();vi.restoreAllMocks();document.body.innerHTML='' })
const site = () => vi.stubGlobal('location',{href:'https://www.bilibili.com/',host:'www.bilibili.com',hostname:'www.bilibili.com',pathname:'/'})

describe('structural maintenance diagnostic', () => {
    it('captures location and structure without reading or serializing private values', () => {
        site()
        document.body.innerHTML=`<div class="center-search__bar"><form id="nav-searchform"><input value="DO_NOT_EXPORT_QUERY"><div class="nav-search-btn">go</div></form><div class="search-panel"><div class="history">DO_NOT_EXPORT_HISTORY</div></div></div><div id="bili-cleaner-shortcut-host"></div><div class="bili-video-card" data-secret="DO_NOT_EXPORT_TOKEN">DO_NOT_EXPORT_TITLE</div>`
        const storageRead=vi.spyOn(Storage.prototype,'getItem')
        const evidence=collectMaintenanceDiagnostic()
        expect(storageRead).not.toHaveBeenCalled()
        expect(JSON.stringify(evidence)).not.toContain('DO_NOT_EXPORT')
        expect(evidence.site).toBe('www.bilibili.com')
        expect(evidence.pageType).toBe('homepage')
        expect(evidence.probes.find(p=>p.id==='search-history')?.count).toBe(1)
        expect(evidence.probes.find(p=>p.id==='shortcut-portal')?.samples[0].parentIsBody).toBe(true)
        expect(evidence.probes.find(p=>p.id==='video-card')?.samples[0].attributeNames).toContain('data-secret')
        expect(validateEvidence(evidence)).toEqual(evidence)
    })

    it('reports missing targets and bounded shadow DOM without assuming failure', () => {
        site()
        const host=document.createElement('bili-comments')
        host.attachShadow({mode:'open'}).innerHTML='<bili-comment-thread-renderer>DO_NOT_EXPORT_COMMENT</bili-comment-thread-renderer>'
        document.body.append(host)
        const evidence=collectMaintenanceDiagnostic()
        expect(evidence.probes.find(p=>p.id==='search-panel')?.count).toBe(0)
        expect(evidence.probes.find(p=>p.id==='comment-shadow-threads')?.count).toBe(1)
        expect(JSON.stringify(evidence)).not.toContain('DO_NOT_EXPORT')
    })

    it('rejects storage dumps, raw HTML and lookalike domains', () => {
        site()
        const evidence=collectMaintenanceDiagnostic()
        expect(()=>validateEvidence({...evidence,cookies:'session=secret'})).toThrow('unsupported fields')
        expect(()=>validateEvidence({...evidence,site:'evilbilibili.com'})).toThrow('page metadata')
        const probe=evidence.probes[0]
        expect(()=>validateEvidence({...evidence,probes:[{...probe,html:'<input value="secret">'}]})).toThrow('unsupported fields')
    })
})
