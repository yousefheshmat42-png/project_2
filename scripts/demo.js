import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createClient } from './client.js';
const adminKey=randomBytes(32).toString('hex');
const {app,db}=createApp({adminKey});
const client=await createClient(app,process.argv.includes('--http'));
async function step(label,method,path,body,token,key,expected) {
  const response=await client.request(method,path,body,token,key);
  if(expected) assert.equal(response.status,expected);
  else assert.ok(response.status>=200 && response.status<300,JSON.stringify(response));
  console.log('\n'+label+' ['+response.status+']');
  console.log(JSON.stringify(response.body,null,2));
  return response.body;
}
try {
  console.log('Task Manager API — isolated demo ('+(process.argv.includes('--http')?'HTTP':'in-process')+')');
  const credentials={email:'student@example.test',password:'Example-pass-123'};
  await step('Register demo user','POST','/auth/register',credentials);
  const login=await client.request('POST','/auth/login',credentials);
  assert.equal(login.status,200);
  const token=login.body.token; // Do not print session tokens.
  
const task=await step('Create task','POST','/tasks',{title:'Finish backend portfolio',description:'Document and test the API'},token);
await step('Complete task','PATCH','/tasks/'+task.id,{status:'done'},token);
await step('Filter completed tasks','GET','/tasks?status=done',undefined,token);
await step('Delete task','DELETE','/tasks/'+task.id,undefined,token);

} finally { await client.close(); db.close(); }

