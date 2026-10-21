import type { MosMappingResolution } from './mosMappingResolution'
import type { LiveBoardExecutionReport } from '../liveboard/runtime'
export interface ReceivedRequest {id:string;receivedAt:string;origin:string|null;remoteAddress:string|null;method:string;path:string;status:number;accepted:boolean;body:Record<string,unknown>|null;mapping?:MosMappingResolution;execution?:LiveBoardExecutionReport}
export interface ReceiverInfo {status:'online'|'error';port:number;accessKey:string;urls:string[];error:string|null}
