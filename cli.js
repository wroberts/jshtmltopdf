const fs = require('fs');
const parseArgs = require('minimist');
const { sendJob, jobQueue, onJobSuccess, onJobFail } = require('./client');

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

async function main() {
  const argv = parseArgs(process.argv.slice(2), { boolean: ["toc"] });
  //console.log(argv);

  if (argv._.length < 2) {
    usage();
    process.exit(1);
  }
  const [url, output] = argv._;
  //console.log(url);
  //console.log(output);

  if (argv.uncollapse) {
    argv.uncollapse = argv.uncollapse.split(/,/g);
  }

  const jobData = {
    url,
    ...argv,
  };

  try {
    const job = await sendJob(jobData);
    console.log(`Job ${job.id} sent`);

    onJobSuccess(job, async (job, result) => {
      console.log(`onjobsuccess ${job.id}`);
      fs.writeFileSync(output, Buffer.from(result, 'base64'));
      await jobQueue.close();
    });
    onJobFail(job, async (job, err) => {
      console.log(`error performing Job: ${err}`);
      await jobQueue.close();
    });
  } catch (err) {
    console.log(`error sending Job: ${err}`);
    return;
  }
}

main().then(console.log).catch(console.error);
