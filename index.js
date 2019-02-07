const puppeteer = require('puppeteer');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async() => {

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.setExtraHTTPHeaders({ authorization: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ3aWxkd2lsaGVsbUBnbWFpbC5jb20iLCJpYXQiOjE1NDk1NTkxNzksImV4cCI6MTU1MDc2ODc3OX0.rBdt5mFNfcg6ZxUXQdADa0pEZZyXtCcWxnLBY5iVYW0' });
  await page.goto('https://universalschema.digital/#!/statements/edit/1271746f23028e11b939204e311c6f12', {waitUntil: 'networkidle2'});

  const openAllAspectsButton = await page.$('rootscope-event-button > button');
  console.log(openAllAspectsButton);
  await openAllAspectsButton.click();
  await sleep(2000);

  // page.pdf() is currently supported only in headless mode.
  // @see https://bugs.chromium.org/p/chromium/issues/detail?id=753118
  await page.pdf({
    path: 'output.pdf',
    format: 'a4'
  });

  browser.close();

})();
