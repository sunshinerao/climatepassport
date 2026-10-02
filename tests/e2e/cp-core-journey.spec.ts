import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();
const email = `synthetic-journey-${Date.now()}@example.invalid`;
const initial = randomBytes(18).toString('base64url');
const verified = randomBytes(18).toString('base64url');
const replacement = randomBytes(18).toString('base64url');
const base = process.env.CP_TEST_BASE_URL!;
const workerSecret = process.env.AUTH_MAIL_WORKER_SECRET!;

async function processMail(api: APIRequestContext) {
 const response = await api.post('/api/internal/auth-mail-worker', {headers:{'x-auth-mail-worker-secret':workerSecret},data:{limit:5}});
 expect(response.status()).toBe(200);
 const lines=(await readFile(process.env.MAIL_TEST_OUTBOX_PATH!,'utf8')).trim().split('\n').map(x=>JSON.parse(x));
 const mail=lines.filter(x=>x.to===email).at(-1);
 expect(mail).toBeTruthy();
 const code=/code is (\d{6})/.exec(mail.text)?.[1];
 const link=/http:\/\/127\.0\.0\.1:[^\s]+/.exec(mail.text)?.[0];
 expect(code).toBeTruthy();expect(link).toBeTruthy();
 return {code:code!,link:link!};
}
async function browserLogin(page:Page,password:string,locale='en') {
 await page.goto(`/${locale}/auth/login`);
 await page.locator('input[name=email]').fill(email);
 await page.locator('input[name=password]').fill(password);
 await page.locator('button[type=submit]').click();
 await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard/`),{timeout:30000});
 const session=await page.request.get('/api/auth/session');
 expect((await session.json()).authenticated).toBe(true);
}

test('real browser + local PostgreSQL core user journey and security boundaries',async({page,browser,playwright})=>{
 test.setTimeout(240000);
 expect(new URL(process.env.DATABASE_URL!).hostname).toBe('127.0.0.1');
 expect(new URL(process.env.DATABASE_URL!).port).toBe('55432');
 expect(process.env.MAIL_TRANSPORT).toBe('test-outbox');
 await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const admin=await playwright.request.newContext({baseURL:base});
 const outsider=await playwright.request.newContext({baseURL:base});
 const adminUser=await prisma.user.findUniqueOrThrow({where:{email:'ops.admin@climatepass.org'}});
 const definition=await prisma.certificateDefinition.findFirstOrThrow({where:{approvalMode:'auto'}});
 const activity=await prisma.activity.create({data:{type:'EVENT',title:'合成测试闭环活动',titleEn:'Synthetic Core Journey Activity',slug:`synthetic-core-${Date.now()}`,createdByUserId:adminUser.id,status:'PUBLISHED',visibility:'PUBLIC',requiresApproval:true,registrationOpenAt:new Date(Date.now()-60000),registrationCloseAt:new Date(Date.now()+86400000),startTime:new Date(),endTime:new Date(Date.now()+3600000),tags:['synthetic-only'],partnerIds:[]}});
 await prisma.activityCertificateRule.create({data:{activityId:activity.id,certificateDefinitionId:definition.id,trigger:'ACTIVITY_CHECKIN',autoIssue:true,isActive:true}});

 await test.step('register via browser; durable queue; worker creates unverified account; no early session',async()=>{
  await page.goto('/en/auth/register');
  for(const [name,value] of Object.entries({name:'Synthetic Core User',phone:'+1 555 010 2026',country:'China',organizationName:'Synthetic Test Organization',email,password:initial}))await page.locator(`input[name=${name}]`).fill(value);
  await page.locator('input[name=country]').press('Escape');
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/en\/auth\/verify-email/,{timeout:30000});
  expect(await prisma.authMailOutbox.count({where:{email,kind:'REGISTER'}})).toBe(1);
  expect(await prisma.user.findUnique({where:{email}})).toBeNull();
  const mail=await processMail(page.request);
  const user=await prisma.user.findUniqueOrThrow({where:{email}});
  expect(user.emailVerified).toBeNull();expect(user.password).toBe('');
  expect((await page.request.post('/api/auth/login',{data:{email,password:initial}})).status()).toBe(401);
  const invalid=await page.request.post('/api/auth/verify-email/confirm',{data:{email,code:mail.code}});expect(invalid.status()).toBe(400);
  await page.locator('input[name=code]').fill(mail.code);
  await page.locator('input[name=password]').fill(verified);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/en\/auth\/login/,{timeout:30000});
  expect((await prisma.user.findUniqueOrThrow({where:{email}})).emailVerified).not.toBeNull();
  expect((await page.request.get('/api/auth/session').then(x=>x.json())).authenticated).toBe(false);
  expect((await page.request.post('/api/auth/verify-email/confirm',{data:{email,code:mail.code,password:verified}})).status()).toBe(400);
  expect((await page.request.post('/api/auth/login',{data:{email,password:initial}})).status()).toBe(401);
 });

 await test.step('login via browser, persist and reload profile, deny administrative access',async()=>{
  await browserLogin(page,verified);
  await page.goto('/en/dashboard/profile');
  await page.getByLabel('Phone',{exact:false}).fill('+1 555 010 9999');
  await page.getByRole('button',{name:'Save Profile',exact:true}).click();
  await expect(page.locator('.form-success')).toBeVisible();
  expect((await prisma.user.findUniqueOrThrow({where:{email}})).phone).toBe('+1 555 010 9999');
  await page.reload();await expect(page.getByLabel('Phone',{exact:false})).toHaveValue('+1 555 010 9999');
  expect((await page.request.get(`/api/activities/${activity.id}`)).status()).toBe(403);
  expect((await outsider.patch('/api/dashboard/profile',{data:{phone:'invalid'}})).status()).toBe(401);
 });

 await test.step('browser application, authorized review, real QR check-in, certificate issue and query',async()=>{
  const user=await prisma.user.findUniqueOrThrow({where:{email}});
  await page.goto(`/en/activities/${activity.slug}/apply`);
  await page.locator('#apply-note').fill('Synthetic browser application.');
  await page.locator('form.form-grid button[type=submit]').click();
  await expect(page).toHaveURL(new RegExp(`/en/activities/${activity.slug}$`),{timeout:30000});
  const application=await prisma.activityApplication.findUniqueOrThrow({where:{activityId_userId:{activityId:activity.id,userId:user.id}}});
  expect(application.status).toBe('SUBMITTED');
  expect((await page.request.post('/api/activity-applications',{data:{activityId:activity.id,userId:user.id,status:'APPROVED'}})).status()).toBe(409);
  expect((await page.request.patch(`/api/activity-applications/${application.id}/review`,{data:{status:'APPROVED'}})).status()).toBe(403);
  expect((await admin.post('/api/auth/login',{data:{email:adminUser.email,password:process.env.CP_TEST_ADMIN_PASSWORD!}})).status()).toBe(200);
  expect((await admin.patch(`/api/activity-applications/${application.id}/review`,{data:{status:'APPROVED'}})).status()).toBe(200);
  const qr=await page.request.post(`/api/activities/${activity.id}/checkin/qr`,{data:{}});expect(qr.status()).toBe(200);const token=(await qr.json()).qr.token;
  expect((await page.request.post('/api/verifier/scan',{data:{token}})).status()).toBe(403);
  const scan=await admin.post('/api/verifier/scan',{data:{token}});expect(scan.status()).toBe(200);
  const result=await scan.json();expect(result.result).toBe('checked_in');expect(result.certificateIssuance.issued).toBe(1);
  const participation=await prisma.activityParticipation.findUniqueOrThrow({where:{activityId_userId:{activityId:activity.id,userId:user.id}}});expect(participation.status).toBe('CHECKED_IN');
  const issued=await prisma.activityCertificateIssuance.findFirstOrThrow({where:{participationId:participation.id},include:{certificateIssue:true}});expect(issued.status).toBe('ISSUED');expect(issued.certificateIssue?.artifactContentType).toBe('application/pdf');
  expect((await admin.post('/api/verifier/scan',{data:{token}})).status()).toBe(404);
  expect(await prisma.activityCertificateIssuance.count({where:{participationId:participation.id}})).toBe(1);
  await page.goto('/en/dashboard/my-activities');await expect(page.locator('main').first()).toContainText('Synthetic Core Journey Activity');
  await page.goto('/en/dashboard/certificates');await expect(page.locator('main').first()).toContainText('Shanghai Climate Week Verified Attendance');
  const issue=issued.certificateIssue!;
  const download=await page.request.post(`/api/certificates/${issue.id}/download`);expect(download.status()).toBe(200);const pdf=await page.request.get((await download.json()).download.url);expect(pdf.status()).toBe(200);expect((await pdf.body()).subarray(0,5).toString()).toBe('%PDF-');
  expect((await outsider.get(`/api/certificates/${issue.id}/artifact?disposition=attachment`)).status()).toBe(401);
 });

 await test.step('forgot password via browser; reset via mail link; revoke old session; require new login',async()=>{
  const oldContext=await browser.newContext({baseURL:base,storageState:await page.context().storageState()});
  await page.goto('/en/auth/forgot-password');await page.locator('input[name=email]').fill(email);await page.locator('button[type=submit]').click();await expect(page.locator('.form-success, .footer-note').filter({hasText:/If eligible|instructions|email has been sent/i}).first()).toBeVisible();
  const mail=await processMail(page.request);
  await page.goto(mail.link);await page.locator('input[name=password]').fill(replacement);await page.locator('button[type=submit]').click();
  await expect(page.locator('.footer-note').filter({hasText:'Password reset complete'})).toBeVisible();
  expect((await oldContext.request.get('/api/auth/session').then(x=>x.json())).authenticated).toBe(false);
  expect((await page.request.post('/api/auth/reset-password',{data:{email,token:new URL(mail.link).searchParams.get('token'),password:replacement}})).status()).toBe(400);
  expect((await page.request.post('/api/auth/login',{data:{email,password:verified}})).status()).toBe(401);
  await browserLogin(page,replacement,'zh');
  await page.request.post('/api/auth/logout');expect((await page.request.get('/api/auth/session').then(x=>x.json())).authenticated).toBe(false);
  await oldContext.close();
 });

 await test.step('cancelled activity rejects new application; anonymous worker rejects; no unintended mail',async()=>{
  await browserLogin(page,replacement);
  const other=await prisma.activity.create({data:{type:'EVENT',title:'Synthetic Cancelled Activity',slug:`synthetic-cancelled-${Date.now()}`,createdByUserId:adminUser.id,status:'CANCELLED',visibility:'PUBLIC',tags:['synthetic-only'],partnerIds:[]}});
  const user=await prisma.user.findUniqueOrThrow({where:{email}});
  expect((await page.request.post('/api/activity-applications',{data:{activityId:other.id,userId:user.id,status:'SUBMITTED'}})).status()).toBe(409);
  expect((await outsider.post('/api/internal/auth-mail-worker',{data:{limit:5}})).status()).toBe(401);
  const lines=(await readFile(process.env.MAIL_TEST_OUTBOX_PATH!,'utf8')).trim().split('\n').map(x=>JSON.parse(x));expect(lines.every(x=>x.to.endsWith('@example.invalid'))).toBe(true);
 });
 await admin.dispose();await outsider.dispose();await prisma.$disconnect();
});
