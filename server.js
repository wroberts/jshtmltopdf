const Queue = require('bull');
const child_process = require('child_process');
const fs = require('fs');
// const http = require('http');
const parseShell = require('shell-quote').parse;
const puppeteer = require('puppeteer');
const tmp = require('tmp');
const util = require('util');

// const HTTP_SERVER_HOST = '0.0.0.0';
// const HTTP_SERVER_PORT = 8080;


// ------------------------------------------------------------
//  PDF Generation
// ------------------------------------------------------------

const readFilePromise = util.promisify(fs.readFile);
const writeFilePromise = util.promisify(fs.writeFile);
const unlinkPromise = util.promisify(fs.unlink);

async function rewriteUrls(page) {
  // https://stackoverflow.com/a/2725168/1062499
  // accessing relative URLs resolves them to absolute URLs;
  // just store back the resolved value.
  await page.$$eval('a', async (els) => { els.forEach((el) => { el['href'] = el['href']; }); });
  await page.$$eval('applet', async (els) => { els.forEach((el) => { el['codebase'] = el['codebase']; }); });
  await page.$$eval('area', async (els) => { els.forEach((el) => { el['href'] = el['href']; }); });
  await page.$$eval('audio', async (els) => { els.forEach((el) => { el['src'] = el['src']; }); });
  await page.$$eval('base', async (els) => { els.forEach((el) => { el['href'] = el['href']; }); });
  await page.$$eval('blockquote', async (els) => { els.forEach((el) => { el['cite'] = el['cite']; }); });
  await page.$$eval('body', async (els) => { els.forEach((el) => { el['background'] = el['background']; }); });
  await page.$$eval('button', async (els) => { els.forEach((el) => { el['formaction'] = el['formaction']; }); });
  await page.$$eval('command', async (els) => { els.forEach((el) => { el['icon'] = el['icon']; }); });
  await page.$$eval('del', async (els) => { els.forEach((el) => { el['cite'] = el['cite']; }); });
  await page.$$eval('embed', async (els) => { els.forEach((el) => { el['src'] = el['src']; }); });
  await page.$$eval('form', async (els) => { els.forEach((el) => { el['action'] = el['action']; }); });
  await page.$$eval('frame', async (els) => { els.forEach((el) => { el['longdesc'] = el['longdesc']; }); });
  await page.$$eval('frame', async (els) => { els.forEach((el) => { el['src'] = el['src']; }); });
  await page.$$eval('head', async (els) => { els.forEach((el) => { el['profile'] = el['profile']; }); });
  await page.$$eval('html', async (els) => { els.forEach((el) => { el['manifest'] = el['manifest']; }); });
  await page.$$eval('iframe', async (els) => { els.forEach((el) => { el['longdesc'] = el['longdesc']; }); });
  await page.$$eval('iframe', async (els) => { els.forEach((el) => { el['src'] = el['src']; }); });
  await page.$$eval('img', async (els) => { els.forEach((el) => { el['longdesc'] = el['longdesc']; }); });
  await page.$$eval('img', async (els) => { els.forEach((el) => { el['src'] = el['src']; }); });
  await page.$$eval('img', async (els) => { els.forEach((el) => { el['usemap'] = el['usemap']; }); });
  await page.$$eval('input', async (els) => { els.forEach((el) => { el['formaction'] = el['formaction']; }); });
  await page.$$eval('input', async (els) => { els.forEach((el) => { el['src'] = el['src']; }); });
  await page.$$eval('input', async (els) => { els.forEach((el) => { el['usemap'] = el['usemap']; }); });
  await page.$$eval('ins', async (els) => { els.forEach((el) => { el['cite'] = el['cite']; }); });
  await page.$$eval('link', async (els) => { els.forEach((el) => { el['href'] = el['href']; }); });
  await page.$$eval('object', async (els) => { els.forEach((el) => { el['classid'] = el['classid']; }); });
  await page.$$eval('object', async (els) => { els.forEach((el) => { el['codebase'] = el['codebase']; }); });
  await page.$$eval('object', async (els) => { els.forEach((el) => { el['data'] = el['data']; }); });
  await page.$$eval('object', async (els) => { els.forEach((el) => { el['usemap'] = el['usemap']; }); });
  await page.$$eval('q', async (els) => { els.forEach((el) => { el['cite'] = el['cite']; }); });
  await page.$$eval('script', async (els) => { els.forEach((el) => { el['src'] = el['src']; }); });
  await page.$$eval('source', async (els) => { els.forEach((el) => { el['src'] = el['src']; }); });
  await page.$$eval('track', async (els) => { els.forEach((el) => { el['src'] = el['src']; }); });
  await page.$$eval('video', async (els) => { els.forEach((el) => { el['poster'] = el['poster']; }); });
  await page.$$eval('video', async (els) => { els.forEach((el) => { el['src'] = el['src']; }); });
}

async function runPuppetteer(url, outFile, options) {
  //console.log(`runPuppetteer starting: ${url} ${outFile}`);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.CHROME_BIN || null,
      args: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    if (options.token) {
      page.setExtraHTTPHeaders({ authorization: options.token });
    }
    await page.goto(url, {waitUntil: 'networkidle2'});

    if (options.uncollapse) {
      for (let id of options.uncollapse) {
        const div = await page.$(id);
        await page.evaluate(d => d.classList.add('in'), div);
      }
      //await sleep(2000);
    }

    // page.pdf() is currently supported only in headless mode.
    // @see https://bugs.chromium.org/p/chromium/issues/detail?id=753118
    //await page.pdf({
    //  path: 'output.pdf',
    //  format: 'a4'
    //});
    await rewriteUrls(page);
    const html = await page.content();
    await writeFilePromise(outFile, html);
  } finally {
    //console.log('runPuppetteer exiting');
    browser.close();
  }
}

function promiseFromChildProcess(child) {
  return new Promise(function (resolve, reject) {
    child.addListener("error", reject);
    child.addListener("exit", resolve);
  });
}

function tmpNamePromise(options) {
  return new Promise((resolve, reject) => {
    tmp.tmpName(options, (err, path) => {
      if (err) reject(err);
      resolve(path);
    });
  });
}

async function handlePDFJob(jobData) {
  let wkprocess;
  let stdout = '';
  let stderr = '';
  let exitcode;
  try {
    const tempHtml = await tmpNamePromise({ template: '/tmp/tmp-XXXXXXXXX.html' });
    //console.log(tempHtml);

    jobData.pdfopts = jobData.pdfopts || '-s a4 --print-media-type';
    const wkargs = parseShell(jobData.pdfopts);

    try {
      await runPuppetteer(jobData.url, tempHtml, { token: jobData.token, uncollapse: jobData.uncollapse });

      const tempPdf = await tmpNamePromise({ template: '/tmp/tmp-XXXXXXXXX.pdf' });

      wkargs.push('--disable-javascript');
      if (jobData.token) {
        wkargs.push('--custom-header');
        wkargs.push('Authorization');
        wkargs.push(jobData.token);
        wkargs.push('--custom-header-propagation');
      }
      if (jobData.toc) {
        wkargs.push('toc');
      }
      wkargs.push(tempHtml);
      wkargs.push(tempPdf);

      //console.log(wkargs);

      wkprocess = child_process.spawn('wkhtmltopdf', wkargs, { cwd: process.cwd() });
      wkprocess.stdout.on('data', (data) => { stdout = stdout + data; });
      wkprocess.stderr.on('data', (data) => { stderr = stderr + data; });
      wkprocess.on('close', (code) => { exitcode = code; });

      try {
        await promiseFromChildProcess(wkprocess);

        const buffer = await readFilePromise(tempPdf);
        return buffer.toString('base64');
      } finally {
        try {
          await unlinkPromise(tempPdf);
        } catch (err) { console.error(err); }
      }
    } finally {
      try{
        await unlinkPromise(tempHtml);
      } catch (err) { console.error(err); }
    }
  } finally {
    if (wkprocess) {
      console.log(stdout);
      console.error(stderr);
      console.log(`wkhtmltopdf exited with status ${exitcode}`);
    }
  }
}

// ------------------------------------------------------------
//  Server
// ------------------------------------------------------------

const redis = {
  host: '127.0.0.1',
  port: 6379,
  db: 0,
  password: 'p4ssw0rd',
};

const options = {
  redis,
};

const jobQueue = new Queue('submitted', options);

// let httpServer;
// function startHttpServer() {
//   httpServer = http.createServer((request, response) => {
//     console.log(request.url);
//     response.statusCode = 200;
//     response.setHeader('Content-Type', 'text/plain');
//     response.end('OK');
//   });
//   httpServer.listen(
//     HTTP_SERVER_PORT, HTTP_SERVER_HOST,
//     (err) =>
//       (err ?
//        console.log('something bad happened', err) :
//        console.log(`HTTP server is listening on ${HTTP_SERVER_PORT}`))
//   );
// }
// startHttpServer();

jobQueue.process((job, done) => {
  console.log('processing job ' + job.id);
  return handlePDFJob(job.data).then((result) => {
    console.log('finished processing job ' + job.id);
    console.log(`result of length ${result.length}`);
    done(null, result);
  }).catch((err) => { done(err); });
});
console.log('processing jobs...');

process.on('uncaughtException', async () => {
  // Queue#close is idempotent - no need to guard against duplicate
  // calls.
  try {
    if (httpServer) await httpServer.close();
    await jobQueue.close();
  } catch (err) {
    console.error('job queue failed to shut down gracefully', err);
  }
  process.exit(1);
});
