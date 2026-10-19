import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';
test('task CRUD, status filter and pagination', async t => {
  const {request,user} = await fixture(t); const token = await user();
  const created = await request('POST','/tasks',{title:'Build API',description:'Write endpoints'},token);
  assert.equal(created.status,201); const path = '/tasks/' + created.body.id;
  assert.equal((await request('GET',path,undefined,token)).body.title,'Build API');
  assert.equal((await request('PATCH',path,{status:'done'},token)).body.status,'done');
  await request('POST','/tasks',{title:'Second task'},token);
  assert.equal((await request('GET','/tasks?status=done',undefined,token)).body.items.length,1);
  assert.equal((await request('GET','/tasks?limit=1&page=2',undefined,token)).body.items[0].title,'Build API');
  assert.equal((await request('DELETE',path,undefined,token)).status,204);
  assert.equal((await request('GET',path,undefined,token)).status,404);
});
test('users cannot read, edit or delete another user task', async t => {
  const {request,user} = await fixture(t); const alice = await user(); const bob = await user('bob@example.test');
  const task = await request('POST','/tasks',{title:'Private task'},alice); const path = '/tasks/' + task.body.id;
  assert.equal((await request('GET','/tasks')).status,401);
  assert.equal((await request('GET','/tasks',undefined,bob)).body.items.length,0);
  for (const method of ['GET','PATCH','DELETE']) assert.equal((await request(method,path,method === 'PATCH' ? {title:'Changed'} : undefined,bob)).status,404);
});
test('invalid task fields, IDs and pagination are rejected', async t => {
  const {request,user} = await fixture(t); const token = await user();
  assert.equal((await request('POST','/tasks',{title:' '},token)).status,400);
  const task = await request('POST','/tasks',{title:'Valid'},token);
  assert.equal((await request('PATCH','/tasks/' + task.body.id,{status:'unknown'},token)).status,400);
  assert.equal((await request('PATCH','/tasks/' + task.body.id,{user_id:2},token)).status,400);
  for (const path of ['/tasks/1oops','/tasks?limit=0','/tasks?status=unknown']) assert.equal((await request('GET',path,undefined,token)).status,400);
});

