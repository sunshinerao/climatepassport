import {test,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';

test('real-mail verified synthetic account signs in through English and Chinese UI without new mail',async({page})=>{
 test.skip(!process.env.CP_REAL_MAIL_TEST_PASSWORD, 'Provide ephemeral synthetic account password for this optional live-mail follow-up.');
 const prisma=new PrismaClient();
 const email='sunshine.rao@gmail.com';
 const before=await prisma.authMailOutbox.count({where:{email}});
 const base=process.env.CP_TEST_BASE_URL!;
 await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 try{
  for(const locale of ['en','zh']){
   await page.goto(`/${locale}/auth/login`);
   await page.locator('input[name=email]').fill(email);
   await page.locator('input[name=password]').fill(process.env.CP_REAL_MAIL_TEST_PASSWORD!);
   await page.locator('button[type=submit]').click();
   await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard/`));
   expect((await page.request.get('/api/auth/session').then(r=>r.json())).authenticated).toBe(true);
   expect((await page.request.post('/api/auth/logout')).status()).toBe(200);
   expect((await page.request.get('/api/auth/session').then(r=>r.json())).authenticated).toBe(false);
  }
  expect(await prisma.authMailOutbox.count({where:{email}})).toBe(before);
 }finally{await prisma.$disconnect();}
});
