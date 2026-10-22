// Browser regression fixture: run the real application routes with only the
// email gateway, identity check and isolated Auth transport mocked. No email or real sessions.
import { createServer } from 'vite';

const server = await createServer({
  server: { host: '127.0.0.1', port: 5181, strictPort: true },
  plugins: [{
    name: 'recovery-routing-test-only',
    enforce: 'pre',
    transform(source, id) {
      const path = id.replaceAll('\\', '/').split('?')[0];
      if (path.endsWith('/src/app/context/useProtectedIdentity.ts')) {
        return `export function useProtectedIdentity() {
          return {result:{state:'loaded',identity:{state:'ready',whitelisted:true,privacy:{currentVersion:'dev-test-only'}}},refresh:async()=>{}};
        }`;
      }
      if (path.endsWith('/src/app/lib/passwordRecoveryGateway.ts')) {
        return `export async function sendRecoveryCode(email) {
          if (email.trim().toLowerCase() !== 'routing@example.test') throw new Error('Use the routing test account.');
          return 'routing@example.test';
        }
        export async function completeRecoveryPassword(){throw new Error('Password writes are disabled in the routing fixture.');}
        export async function continueRecoverySignIn(){return false;}
        export async function resumePasswordChangeLogin(){return false;}`;
      }
      if (path.endsWith('/src/app/lib/supabaseClient.ts')) {
        return `
          export function getSupabaseClient() { throw new Error('Real backend calls are disabled in the routing fixture.'); }
          export function createPasswordCheckClient() {
            return {auth: {
              async verifyOtp({email,token,type}) {
                const valid=email==='routing@example.test' && token==='123456' && type==='recovery';
                return {data:{session:valid?{}:null},error:valid?null:{message:'Invalid test code'}};
              },
              mfa: {async listFactors(){return {data:{totp:[]},error:null};}},
              async signOut(){return {error:null};},
              async updateUser(){throw new Error('Password writes are disabled in the routing fixture.');}
            }};
          }`;
      }
    },
  }],
});
await server.listen();
console.log('Recovery routing fixture ready at http://127.0.0.1:5181/forgot-password. Only routing@example.test and test code 123456 are accepted. No email, real sessions, or password writes.');
process.on('SIGINT', async () => { await server.close(); process.exit(0); });
