const beeQueue = require('bee-queue');
const child_process = require('child_process');
const fs = require('fs');
const http = require('http');
const parseShell = require('shell-quote').parse;
const puppeteer = require('puppeteer');
const tmp = require('tmp');
const util = require('util');

const HTTP_SERVER_HOST = '0.0.0.0';
const HTTP_SERVER_PORT = 8080;


// ------------------------------------------------------------
//  PDF Generation
// ------------------------------------------------------------

const writeFilePromise = util.promisify(fs.writeFile);
const unlinkPromise = util.promisify(fs.unlink);

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
    const tempfile = await tmpNamePromise({ template: '/tmp/tmp-XXXXXXXXX.html' });
    //console.log(tempfile);

    try {
      jobData.pdfopts = jobData.pdfopts || '-s a4 --print-media-type';
      const wkargs = parseShell(jobData.pdfopts);

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
      wkargs.push(tempfile);
      wkargs.push(jobData.output);

      //console.log(wkargs);

      if (jobData.uncollapse) {
        jobData.uncollapse = jobData.uncollapse.split(/,/g);
      }

      await runPuppetteer(jobData.url, tempfile, { token: jobData.token, uncollapse: jobData.uncollapse });

      wkprocess = child_process.spawn('wkhtmltopdf', wkargs, { cwd: process.cwd() });
      wkprocess.stdout.on('data', (data) => { stdout = stdout + data; });
      wkprocess.stderr.on('data', (data) => { stderr = stderr + data; });
      wkprocess.on('close', (code) => { exitcode = code; });
      await promiseFromChildProcess(wkprocess);
    } finally {
      await unlinkPromise(tempfile);
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
  /*host: 'somewhereElse'*/
};

const options = {
  redis,
  isWorker: true,
  sendEvents: true,
  stallInterval: 10000,
  activateDelayedJobs: true,

  removeOnSuccess: true,
  removeOnFailure: true,
  nearTermWindow: 1200000,
  delayedDebounce: 1000,
  storeJobs: true,
  ensureScripts: true,
  redisScanCount: 100
};

const jobQueue = new beeQueue('submitted', options);

let httpServer;
function startHttpServer() {
  httpServer = http.createServer((request, response) => {
    console.log(request.url);
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/plain');
    response.end('OK');
  });
  httpServer.listen(
    HTTP_SERVER_PORT, HTTP_SERVER_HOST,
    (err) =>
      (err ?
       console.log('something bad happened', err) :
       console.log(`HTTP server is listening on ${HTTP_SERVER_PORT}`))
  );
}

jobQueue.on('ready', function () {
  startHttpServer();
  jobQueue.process(async (job) => {
    console.log('processing job ' + job.id);
    const result = await handlePDFJob(job.data);
    return result;
  });

  console.log('processing jobs...');
});

// Some reasonable period of time for all your concurrent jobs to
// finish processing. If a job does not finish processing in this
// time, it will stall and be retried. As such, do attempt to make
// your jobs idempotent, as you generally should with any queue that
// provides at-least-once delivery.
const TIMEOUT = 30 * 1000;

process.on('uncaughtException', async () => {
  // Queue#close is idempotent - no need to guard against duplicate
  // calls.
  try {
    if (httpServer) await httpServer.close();
    await jobQueue.close(TIMEOUT);
  } catch (err) {
    console.error('bee-queue failed to shut down gracefully', err);
  }
  process.exit(1);
});
