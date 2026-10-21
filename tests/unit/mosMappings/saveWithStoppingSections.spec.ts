import {describe,expect,it,vi} from 'vitest'
import {saveWithStoppingSections,type SettingsSaveAttempt} from '../../../src/features/mos-mappings/saveWithStoppingSections'

const denied:SettingsSaveAttempt<unknown>={ok:false,error:{code:'MOS_MAPPINGS_ACTIVE',sectionNames:['Titlu','Nume']}}
const saved:SettingsSaveAttempt<unknown>={ok:true,value:{mode:'simulation',host:'127.0.0.1',port:null,timeoutMs:5000}}

describe('settings save with active sections',()=>{
  it('stops every named section and retries the save once',async()=>{
    const save=vi.fn().mockResolvedValueOnce(denied).mockResolvedValueOnce(saved)
    const stop=vi.fn().mockResolvedValue(undefined)
    const onStopping=vi.fn()
    const result=await saveWithStoppingSections(save,[{id:'title',name:'Titlu'},{id:'names',name:'Nume'}],stop,onStopping)
    expect(result).toBe(saved)
    expect(stop.mock.calls).toEqual([['title'],['names']])
    expect(save).toHaveBeenCalledTimes(2)
    expect(onStopping).toHaveBeenCalledWith(['Titlu','Nume'])
  })

  it('does not retry if a STOP command fails',async()=>{
    const save=vi.fn().mockResolvedValue(denied)
    const stop=vi.fn().mockRejectedValue(new Error('STOP failed'))
    await expect(saveWithStoppingSections(save,[{id:'title',name:'Titlu'},{id:'names',name:'Nume'}],stop,vi.fn())).rejects.toThrow('STOP failed')
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('preserves the denial when a section name cannot be resolved',async()=>{
    const save=vi.fn().mockResolvedValue(denied)
    const stop=vi.fn()
    const result=await saveWithStoppingSections(save,[{id:'title',name:'Titlu'}],stop,vi.fn())
    expect(result).toBe(denied)
    expect(stop).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledTimes(1)
  })
})
