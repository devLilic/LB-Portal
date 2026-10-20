import {useCallback,useEffect,useState} from 'react'
import {useTranslation} from 'react-i18next'
import type {ReceivedRequest,ReceiverInfo} from '../shared/ingress/contracts'
import MosMappingsSettings from '../features/mos-mappings/MosMappingsSettings'
import MosMappingReport from '../features/ingress/MosMappingReport'
import LiveBoardConsole from '../features/liveboard/LiveBoardConsole'
import './App.css'
import '../features/ingress/console.css'
import '../features/mos-mappings/mos-mappings.css'

function App(){
 const [info,setInfo]=useState<ReceiverInfo|null>(null)
 const [requests,setRequests]=useState<ReceivedRequest[]>([])
 const [copied,setCopied]=useState(false)
 const [page,setPage]=useState<'console'|'settings'>('console')
 const [requestSettingsClose,setRequestSettingsClose]=useState<null|(()=>void)>(null)
 const {t}=useTranslation('settings')
 const registerSettingsClose=useCallback((close:null|(()=>void))=>setRequestSettingsClose(()=>close),[])
 useEffect(()=>{let active=true;const receive=(r:ReceivedRequest)=>setRequests(xs=>[r,...xs.filter(item=>item.id!==r.id)].slice(0,100));const update=(r:ReceivedRequest)=>setRequests(xs=>xs.map(item=>item.id===r.id?r:item));void Promise.all([window.lbPortalApi.getInfo(),window.lbPortalApi.getRequests()]).then(([i,r])=>{if(active){setInfo(i);setRequests(current=>{const byId=new Map(r.map(item=>[item.id,item]));current.forEach(item=>byId.set(item.id,item));return [...byId.values()].sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt)).slice(0,100)})}}).catch(()=>undefined);const off=window.lbPortalApi.onRequestReceived(receive);const offUpdate=window.lbPortalApi.onRequestUpdated(update);return()=>{active=false;off();offUpdate()}},[])
 const copy=async()=>{if(!info?.accessKey)return;await navigator.clipboard.writeText(info.accessKey);setCopied(true);setTimeout(()=>setCopied(false),1500)}
 return <main className="portal"><header className="portal-header"><div><p className="eyebrow">Plasma · receiver local</p><h1>LB-Portal</h1><p>Consolă pentru cereri MOS și execuția LiveBoard</p></div><span className="status">{info?.status==='online'?'Ascultă pe portul 47835':info?.error??'Se pornește…'}</span></header>
 <nav className="portal-nav" aria-label={t('mos.nav')}><button type="button" aria-current={page==='console'?'page':undefined} onClick={()=>page==='settings'?requestSettingsClose?.():setPage('console')}>{t('mos.console')}</button><button type="button" aria-current={page==='settings'?'page':undefined} onClick={()=>setPage('settings')}>{t('mos.settings')}</button></nav>
 {page==='settings'?<MosMappingsSettings onClose={()=>setPage('console')} onRegisterClose={registerSettingsClose}/>:<>
 <section className="card"><h2>Conexiune Plasma</h2><div className="urls">{info?.urls.map(url=><code key={url}>{url}</code>)}</div><p>Alege IP-ul acestui calculator pentru Setări Plasma. Portul receiverului este 47835.</p><div className="key-row"><input readOnly value={info?.accessKey??''} aria-label="Cheia de acces"/><button onClick={()=>void copy()} disabled={!info?.accessKey}>{copied?'Copiată':'Copiază cheia'}</button></div></section>
 <LiveBoardConsole/>
 <section className="card"><div className="row"><h2>Cereri primite ({requests.length})</h2><button onClick={()=>{void window.lbPortalApi.clearRequests().then(()=>setRequests([]))}}>Șterge consola</button></div>{requests.length===0?<p>Nu există cereri. Salvează datele în Setări Plasma și apasă „Testează conexiunea”.</p>:requests.map(r=>{const execution=r.execution;const failed=!r.accepted||['blocked','failed'].includes(execution?.status??'')||!!r.mapping&&r.mapping.status!=='matched';const detail=r.mapping?.status==='matched'?`${r.mapping.section.name} · ${r.mapping.template}`:r.mapping?.template??r.path;const error=execution?.error||(r.mapping&&r.mapping.status!=='matched'?r.mapping.status:'');return <article className="entry entry-compact" key={r.id}><details className="request-detail"><summary><span className={failed?'bad':'good'}>{r.accepted?'Primită':'Respinsă'} · HTTP {r.status}{execution?` · ${execution.status.toUpperCase()}`:''}</span><span className="request-detail-context">{detail}{error?` · ${error}`:''}</span><time>{new Date(r.receivedAt).toLocaleString()}</time></summary><div className="request-detail-body"><p>{r.method} {r.path} · {r.origin??'Origin necunoscut'} · {r.remoteAddress??'IP necunoscut'}</p>{r.mapping&&<MosMappingReport mapping={r.mapping} execution={execution}/ >}{r.body&&<details className="request-raw"><summary>{t('mos.consoleMapping.rawRequest')}</summary><pre>{JSON.stringify(r.body,null,2)}</pre></details>}</div></details></article>})}</section></> }</main>
}
export default App
