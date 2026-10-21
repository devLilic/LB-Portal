import { useTranslation } from 'react-i18next'
import type { MosMappingResolution } from '../../shared/ingress/mosMappingResolution'
import type {LiveBoardExecutionReport} from '../../shared/liveboard/runtime'

export default function MosMappingReport({ mapping,execution }: { mapping: MosMappingResolution;execution?:LiveBoardExecutionReport }) {
  const { t } = useTranslation('settings')
  if (mapping.status !== 'matched') {
    return <section className={`mos-report mos-report-${mapping.status}`} aria-label={t('mos.consoleMapping.title')}>
      <div className="mos-report-heading"><strong>{t(`mos.consoleMapping.${mapping.status}`)}</strong>{execution&&<span>{t(`liveBoard.executionStatus.${execution.status}`)}</span>}</div>
      {mapping.status==='project-disabled'&&<><p className="mos-report-context"><strong>{mapping.project.name}</strong> · {t(`mos.projects.kind.${mapping.project.kind}`)}</p><p>{t('mos.consoleMapping.projectDisabledHelp')}</p></>}
      {mapping.template !== null && <p>{t('mos.consoleMapping.source')}: <code>{mapping.template}</code></p>}
      {execution&&<><div className="lb-execution-summary">{execution.projectName&&<span>{t('mos.projects.project')}: {execution.projectName}</span>}<span>{execution.mode==='simulation'?t('liveBoard.simulation'):t('liveBoard.tcp')}</span>{execution.sectionName&&<span>{execution.sectionName}</span>}{execution.selectedBuffer&&<span>{t('liveBoard.chosenBuffer')}: {t(`liveBoard.buffer.${execution.selectedBuffer}`)}</span>}{execution.previousTargetId&&<span>{t('liveBoard.previousBuffer')}: {execution.previousTargetId}</span>}{execution.nextBuffer&&<span>{t('liveBoard.nextBuffer')}: {t(`liveBoard.buffer.${execution.nextBuffer}`)}</span>}</div><ExecutionSteps execution={execution}/></>}
    </section>
  }

  const reportTargets=execution?.selectedTargetId?mapping.targets.filter(target=>target.id===execution.selectedTargetId):mapping.targets
  const hasMappings = reportTargets.some(target => target.fields.length > 0)
  return <section className="mos-report" aria-label={t('mos.consoleMapping.title')}>
    <div className="mos-report-heading"><strong>{t('mos.consoleMapping.title')}</strong><span>{t('mos.consoleMapping.configured')}</span></div>
    <p className="mos-report-context">{t('mos.projects.project')}: <b>{execution?.projectName??mapping.project.name}</b> · {t(`mos.projects.kind.${execution?.projectKind??mapping.project.kind}`)}</p>
    <p className="mos-report-context">{t('mos.consoleMapping.section')}: <b>{mapping.section.name}</b> · {t('mos.consoleMapping.source')}: <code>{mapping.template}</code></p>
    {mapping.commandType === 'mos-resume' ? <p className="mos-report-empty">{t('mos.consoleMapping.resumeNoParams')}</p> : !hasMappings && <p className="mos-report-empty">{t('mos.consoleMapping.graphicOnly', { template: mapping.template })}</p>}
    {execution&&<div className="lb-execution-summary"><strong>{t(`liveBoard.executionStatus.${execution.status}`)}</strong>{execution.projectName&&<span>{t('mos.projects.project')}: {execution.projectName}</span>}<span>{execution.mode==='simulation'?t('liveBoard.simulation'):t('liveBoard.tcp')}</span>{execution.sectionName&&<span>{execution.sectionName}</span>}{execution.selectedBuffer&&<span>{t('liveBoard.chosenBuffer')}: {t(`liveBoard.buffer.${execution.selectedBuffer}`)}</span>}{execution.previousTargetId&&<span>{t('liveBoard.previousBuffer')}: {mapping.targets.find(target=>target.id===execution.previousTargetId)?.template??'—'}</span>}{execution.nextBuffer&&<span>{t('liveBoard.nextBuffer')}: {t(`liveBoard.buffer.${execution.nextBuffer}`)}</span>}</div>}
    {mapping.commandType !== 'mos-resume' && reportTargets.map(target => <div className="mos-report-target" key={target.id}>
      <h4>{target.template}</h4>
      {target.fields.length > 0 && <div className="mos-report-table-wrap"><table><thead><tr><th>{t('mos.consoleMapping.param')}</th><th>{t('mos.consoleMapping.field')}</th><th>{t('mos.consoleMapping.value')}</th></tr></thead>
        <tbody>{target.fields.map((field, index) => <tr key={`${field.param}-${index}`}><td>{field.param}</td><td>{field.fields.length ? field.fields.join(', ') : '—'}</td><td>{field.value === null ? <em>{t('mos.consoleMapping.missing')}</em> : field.value === '' ? <em>{t('mos.consoleMapping.empty')}</em> : field.value}</td></tr>)}</tbody></table></div>}
    </div>)}
    <p className="mos-report-exit">{mapping.exitMode === 'manual-resume' ? t('mos.consoleMapping.manualResume') : t('mos.consoleMapping.duration', { seconds: mapping.durationSeconds })}
      {mapping.targets.length === 2 && <> · {t('mos.consoleMapping.pairDelay', { ms: mapping.resumePlayDelayMs })}</>}
    </p>
    {mapping.commandType !== 'mos-resume' && (mapping.missingParams.length > 0 || mapping.unmappedParams.length > 0) && <div className="mos-report-diagnostics">
      {mapping.missingParams.length > 0 && <p><strong>{t('mos.consoleMapping.missingParams')}:</strong> {mapping.missingParams.join(', ')}</p>}
      {mapping.unmappedParams.length > 0 && <p><strong>{t('mos.consoleMapping.unmappedParams')}:</strong> {mapping.unmappedParams.join(', ')}</p>}
    </div>}
    {execution?<ExecutionSteps execution={execution}/>:<p className="mos-report-caption">{t('mos.consoleMapping.notExecuted')}</p>}
  </section>
}

function ExecutionSteps({execution}:{execution:LiveBoardExecutionReport}){
  const {t}=useTranslation('settings')
  return <><p className="mos-report-caption">{t(`liveBoard.confirmation.${execution.confirmation}`)}</p>{execution.interactionRuleName&&<p className="mos-report-caption">{t('liveBoard.interactionRule')}: <strong>{execution.interactionRuleName}</strong></p>}<ol className="lb-step-list">{execution.steps.map((step,index)=><li className={`step-${step.state}`} key={`${index}-${step.kind}`}><div><strong>{step.interactionAction?t(`mos.interactions.kinds.${step.interactionAction}`):t(`liveBoard.step.${step.kind}`)}</strong><span>{t(`liveBoard.stepState.${step.state}`)}</span></div>{step.interactionRuleName&&<p>{t('liveBoard.interactionRule')}: <strong>{step.interactionRuleName}</strong></p>}{step.provenance&&<p>{t(`liveBoard.provenance.${step.provenance}`)}</p>}{step.sourceSectionName&&<p>{t('liveBoard.sourceSection')}: {step.sourceSectionName}</p>}{step.affectedSectionName&&<p>{t('liveBoard.affectedSection')}: {step.affectedSectionName}</p>}{step.template&&<code>{step.template}</code>}{step.field&&<p>{step.field}: {step.value??''}</p>}{step.command&&<code>{step.command}</code>}{step.response&&<code>{step.response}</code>}{step.ms!==undefined&&<small>{step.ms} ms</small>}{step.error&&<p className="lb-error">{step.error}</p>}</li>)}</ol>{execution.error&&<p className="lb-error">{execution.error}</p>}</>
}
