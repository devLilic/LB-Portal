import {describe,expect,it} from 'vitest'
import type {ReceivedRequest} from '../../../src/shared/ingress/contracts'
import type {MosMappingConfig} from '../../../src/shared/settings/mosMappings'
import {collectMosSuggestions} from '../../../src/features/mos-mappings/suggestions'

const req=(body:Record<string,unknown>|null,accepted=true):ReceivedRequest=>({id:crypto.randomUUID(),receivedAt:new Date().toISOString(),origin:null,remoteAddress:null,method:'POST',path:'/v1/requests',status:accepted?200:400,accepted,body})
const empty:MosMappingConfig={version:1,sections:[]}

describe('collectMosSuggestions',()=>{
 it('uses accepted valid requests and saved source mappings, excluding rejected and malformed requests and target names',()=>{
  const config:MosMappingConfig={version:1,sections:[{id:'s',name:'Sports',resumePlayDelayMs:100,targets:[{id:'t',template:'LIVEBOARD_ONLY'}],sources:[{id:'src',template:'SavedSource',exitMode:'manual-resume',durationSeconds:6,fields:[{id:'f',param:'SavedParam',targetFields:{t:'LBField'}}]}]}]}
  const requests=[
   req({type:'mos-play',template:'AcceptedTemplate',params:{Title:'Goal'}}),
   req({type:'mos-play',template:'GraphicOnly'}),
   req({type:'mos-play',template:'RejectedTemplate',params:{Nope:'x'}},false),
   req({type:'mos-play',template:'MalformedParams',params:{Title:3}}),
   req({type:'mos-play',template:'MalformedKey',params:{' ':'bad'}}),
   req({type:'other',template:'WrongType',params:{Nope:'x'}}),
  ]
  const result=collectMosSuggestions(requests,config)
  expect(result.templates).toEqual(['AcceptedTemplate','GraphicOnly','SavedSource'])
  expect(result.paramsByTemplate.AcceptedTemplate).toEqual(['Title'])
  expect(result.paramsByTemplate.GraphicOnly).toEqual([])
  expect(result.paramsByTemplate.SavedSource).toEqual(['SavedParam'])
  expect(result.allParams).toEqual(['SavedParam','Title'])
  expect(result.templates).not.toContain('LIVEBOARD_ONLY')
  expect(result.allParams).not.toContain('LBField')
 })
 it('ignores a whole request when its params object is malformed',()=>{
  const result=collectMosSuggestions([req({type:'mos-play',template:'Bad',params:[] as unknown as Record<string,unknown>})],empty)
  expect(result.templates).toEqual([])
 })
})
