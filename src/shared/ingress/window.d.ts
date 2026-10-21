import type {ReceivedRequest,ReceiverInfo} from './contracts'
import type { LiveBoardApi } from '../liveboard/runtime'
declare global { interface Window { lbPortalApi:{getInfo:()=>Promise<ReceiverInfo>;getRequests:()=>Promise<ReceivedRequest[]>;clearRequests:()=>Promise<void>;onRequestReceived:(listener:(request:ReceivedRequest)=>void)=>()=>void;onRequestUpdated:(listener:(request:ReceivedRequest)=>void)=>()=>void};liveBoardApi:LiveBoardApi } }
export {}
