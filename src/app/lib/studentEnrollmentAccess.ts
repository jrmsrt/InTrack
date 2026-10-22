export const enrollmentPendingMessage = 'Your account is verified, but you are not yet enrolled in an OJT practicum. Enter the class code shared by your adviser below and wait for their approval. Until your request is approved, only your dashboard is available. Contact your adviser if you do not have a code.';

/** Missing enrollment is distinct from an enrolled student's deployment lock. */
export function studentRouteNeedsEnrollment(pathname:string,enrolled:boolean):boolean {
 return !enrolled && (pathname.replace(/\/+$/,'')||'/')!=='/dashboard';
}
