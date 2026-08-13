import json, os, uuid, datetime, decimal
import boto3

ddb=boto3.resource('dynamodb'); from botocore.config import Config

s3 = boto3.client(
    "s3",
    region_name="af-south-1",
    endpoint_url="https://s3.af-south-1.amazonaws.com",
    config=Config(
        signature_version="s3v4",
        s3={"addressing_style": "virtual"}
    )
)

jobs=ddb.Table(os.environ['JOBS_TABLE']); audit=ddb.Table(os.environ['AUDIT_TABLE'])
origin=os.environ.get('ALLOWED_ORIGIN','*')
VALID_STATUSES={'incoming','in_progress','in_review','awaiting_documents','ready_to_send','completed'}

class Encoder(json.JSONEncoder):
    def default(self,o):
        if isinstance(o,decimal.Decimal): return int(o) if o%1==0 else float(o)
        return super().default(o)
def response(code,body): return {'statusCode':code,'headers':{'content-type':'application/json','access-control-allow-origin':origin},'body':json.dumps(body,cls=Encoder)}
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def record(message,job_id): audit.put_item(Item={'event_id':str(uuid.uuid4()),'job_id':job_id,'message':message,'created_at':now()})

def handler(event,context):
    method=event.get('requestContext',{}).get('http',{}).get('method','GET'); path=event.get('rawPath','/')
    if path=='/health': return response(200,{'status':'ok'})
    if method=='GET' and path=='/jobs':
        data=jobs.scan().get('Items',[]); data.sort(key=lambda x:x.get('created_at',''),reverse=True); return response(200,{'items':data})
    if method=='POST' and path=='/jobs':
        body=json.loads(event.get('body') or '{}'); required=['customer','contact','email','filename']
        missing=[x for x in required if not body.get(x)]
        if missing:return response(400,{'message':'Missing required fields','fields':missing})
        stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%y%m'); job_id=f"JNIT-{stamp}-{uuid.uuid4().hex[:6].upper()}"; key=f"{body['customer'].strip().replace(' ','-').lower()}/{job_id}/{body['filename']}"
        item={'job_id':job_id,'customer':body['customer'],'contact':body['contact'],'email':body['email'],'filename':body['filename'],'border':body.get('border',''),'origin':body.get('origin',''),'notes':body.get('notes',''),'status':'incoming','agent_name':'','agent_id':'','s3_key':key,'created_at':now(),'updated_at':now()}
        jobs.put_item(Item=item); record('Job created by customer portal upload',job_id)
        url=s3.generate_presigned_url('put_object',Params={'Bucket':os.environ['DOCUMENTS_BUCKET'],'Key':key,'ContentType':body.get('content_type','application/octet-stream')},ExpiresIn=900)
        return response(201,{'job':item,'upload_url':url})
    if method=='PATCH' and path.startswith('/jobs/'):
        job_id=path.rsplit('/',1)[-1]; body=json.loads(event.get('body') or '{}'); allowed={'status','agent_name','agent_id','notes'}; changes={k:v for k,v in body.items() if k in allowed}
        if not changes:return response(400,{'message':'No supported changes supplied'})
        if 'status' in changes and changes['status'] not in VALID_STATUSES:
            return response(400,{'message':'Unsupported workflow status','allowed_statuses':sorted(VALID_STATUSES)})
        names={f'#k{i}':k for i,k in enumerate(changes)}; values={f':v{i}':v for i,v in enumerate(changes)}; names['#updated_at']='updated_at'; values[':updated_at']=now()
        expression='SET '+', '.join([f'{nk}={vk}' for nk,vk in zip(names.keys(),values.keys())])
        result=jobs.update_item(Key={'job_id':job_id},UpdateExpression=expression,ExpressionAttributeNames=names,ExpressionAttributeValues=values,ReturnValues='ALL_NEW')
        record('Job updated: '+', '.join(changes.keys()),job_id); return response(200,{'job':result['Attributes']})
    return response(404,{'message':'Not found'})
