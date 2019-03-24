const fs = require('fs');
const parseArgs = require('minimist');
const beeQueue = require('bee-queue');

const redis = {
  /*host: 'somewhereElse'*/
};

const options = {
  redis,
  isWorker: false,
  getEvents: true,
  stallInterval: 10000,

  nearTermWindow: 1200000,
  delayedDebounce: 1000,
  storeJobs: true,
  ensureScripts: true,
  activateDelayedJobs: false,
  redisScanCount: 100
};

const jobQueue = new beeQueue('submitted', options);

jobQueue.on('ready', () => {
  console.log('queue now ready to start doing things');
});
jobQueue.on('error', (err) => {
  console.log(`A queue error happened: ${err.message}`);
});
jobQueue.on('succeeded', (job, result) => {
  console.log(`Job ${job.id} succeeded`);
});
jobQueue.on('retrying', (job, err) => {
  console.log(`Job ${job.id} failed with error ${err.message} but is being retried!`);
});
jobQueue.on('failed', (job, err) => {
  console.log(`Job ${job.id} failed with error ${err.message}`);
});
jobQueue.on('stalled', (jobId) => {
  console.log(`Job ${jobId} stalled and will be reprocessed`);
});
jobQueue.on('job succeeded', (jobId, result) => {
  console.log(`Job ${jobId} succeeded`);
});
jobQueue.on('job retrying', (jobId, err) => {
  console.log(`Job ${jobId} failed with error ${err.message} but is being retried!`);
});

function sendJob(data) {
  const job = jobQueue.createJob(data)
        .retries(3)
        .backoff('fixed', 2000)
        .timeout(30000);

  job.on('succeeded', function (result) {
    console.log('completed job ' + job.id);
  });

  job.save(function (err, job) {
    if (err) {
      console.log('job failed to save');
    } else {
      console.log('saved job ' + job.id);
    }
  });

  return job;
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

  const jobData = {
    url,
    ...argv,
  };

  const job = sendJob(jobData);

  job.on('succeeded', (result) => {
    console.log(`Job ${job.id} succeeded with result`);
    fs.writeFileSync(output, Buffer.from(result, 'base64'));
    jobQueue.close();
  });
  job.on('failed', (err) => {
    console.log(`Job ${job.id} failed with error ${err.message}`);
    jobQueue.close();
  });
}

main();
