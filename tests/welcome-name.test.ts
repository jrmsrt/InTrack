import {test} from 'node:test';
import assert from 'node:assert/strict';
import {welcomeName} from '../src/app/lib/welcomeName.ts';
test('greetings use given names without changing the saved display name',()=>{
  assert.equal(welcomeName('Dela Cruz, Juan Carlo R.'),'Juan Carlo');
  assert.equal(welcomeName('Masarate, Jaira R.'),'Jaira');
  assert.equal(welcomeName('Jaira R. Masarate'),'Jaira');
  assert.equal(welcomeName('Michael Chen'),'Michael');
  assert.equal(welcomeName('Dela Cruz, Juan Carlo'),'Juan Carlo');
  assert.equal(welcomeName('  Ana  '),'Ana');
  assert.equal(welcomeName(null),'there');
});
