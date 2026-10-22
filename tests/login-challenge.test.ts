import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLoginChallenge, saveLoginChallenge, LOGIN_CHALLENGE_KEY } from '../src/app/lib/loginChallenge.ts';

test('login navigation metadata rejects corruption and invalid times', () => {
  const now = 100000000;
  for (const input of ['bad json', 'null', JSON.stringify({email:'invalid',requestedAt:now}), JSON.stringify({email:'a@example.test',requestedAt:now+6000}), JSON.stringify({email:'a@example.test',requestedAt:0})]) {
    assert.equal(parseLoginChallenge(input, now), null);
  }
  assert.deepEqual(parseLoginChallenge(JSON.stringify({email:' A@Example.test ',role:'student',requestedAt:now,token:'never trust',authenticated:true}),now), {email:'a@example.test',requestedAt:now});
});

test('refresh metadata never persists a code, password or authentication flag', () => {
  const values = new Map<string,string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{setItem:(key:string,value:string)=>values.set(key,value)}});
  try {
    saveLoginChallenge({email:'a@example.test',requestedAt:100,...{role:'adviser',code:'123456',password:'private',authenticated:true}});
    assert.deepEqual(JSON.parse(values.get(LOGIN_CHALLENGE_KEY)!),{email:'a@example.test',requestedAt:100});
  } finally {
    if(previous)Object.defineProperty(globalThis,'sessionStorage',previous);
    else Reflect.deleteProperty(globalThis,'sessionStorage');
  }
});
