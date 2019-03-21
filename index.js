const child_process = require('child_process');
const fs = require('fs');
const parseArgs = require('minimist');
const parseShell = require('shell-quote').parse;
const puppeteer = require('puppeteer');
const tmp = require('tmp');
const util = require('util');

const writeFilePromise = util.promisify(fs.writeFile);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runPuppetteer(url, outFile, options) {
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
    browser.close();
  }
}

function usage() {
  console.log("jshtmltopdf\n");
  console.log("Usage:");
  console.log("   jshtmltopdf [OPTIONS] URL PDF\n");
  console.log("Options:");
  console.log("   --toc         flag: ask wkhtmltopdf to insert a table of contents");
  console.log("   --pdfopts     flags to send to wkhtmltopdf. Defaults to");
  console.log("                 '-s a4 --print-media-type'.");
  console.log("   --token       if specified, the value of the Authorization header to");
  console.log("                 be sent in HTTP requests");
  console.log("   --uncollapse  a comma-separated list of element IDs that should be");
  console.log("                 uncollapsed before printing");
}

function main() {
  const argv = parseArgs(process.argv.slice(2), { boolean: ["toc"] });
  //console.log(argv);

  if (argv._.length < 2) {
    usage();
    process.exit(1);
  }
  const [url, output] = argv._;
  //console.log(url);
  //console.log(output);

  const tempfile = `${tmp.tmpNameSync()}.html`;
  //console.log(tempfile);

  argv.pdfopts = argv.pdfopts || '-s a4 --print-media-type';
  const wkargs = parseShell(argv.pdfopts);

  wkargs.push('--disable-javascript');
  if (argv.token) {
    wkargs.push('--custom-header');
    wkargs.push('Authorization');
    wkargs.push(argv.token);
    wkargs.push('--custom-header-propagation');
  }
  if (argv.toc) {
    wkargs.push('toc');
  }
  wkargs.push(tempfile);
  wkargs.push(output);

  //console.log(wkargs);

  if (argv.uncollapse) {
    argv.uncollapse = argv.uncollapse.split(/,/g);
  }
  runPuppetteer(url, tempfile, { token: argv.token, uncollapse: argv.uncollapse })
    .then(() => {
      const wkprocess = child_process.spawnSync('wkhtmltopdf', wkargs, { cwd: process.cwd() });
      console.log(wkprocess.stdout.toString());
      console.error(wkprocess.stderr.toString());
      console.log(`wkhtmltopdf exited with status ${wkprocess.status}`);
    })
    .catch(console.error);
}

main();
