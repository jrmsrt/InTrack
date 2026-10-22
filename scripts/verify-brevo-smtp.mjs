import nodemailer from 'nodemailer';
const user=process.env.INTRACK_AUTH_SMTP_USER,pass=process.env.INTRACK_AUTH_SMTP_PASSWORD;
if(!user||!pass)throw new Error('Load the private SMTP environment first.');
const transport=nodemailer.createTransport({host:'smtp-relay.brevo.com',port:587,secure:false,requireTLS:true,
 auth:{user,pass},connectionTimeout:15000,greetingTimeout:10000,socketTimeout:15000,dnsTimeout:5000,
 logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
try{await transport.verify();console.log('Brevo SMTP authenticated successfully over STARTTLS. No email was sent.');}
catch(error){const known=['EAUTH','EDNS','ECONNECTION','ETIMEDOUT','ESOCKET'];
 console.error('SMTP verification failed: '+(known.includes(error.code)?error.code:'unclassified')+'. Credential values and provider responses withheld.');process.exitCode=1;}
finally{transport.close();}
