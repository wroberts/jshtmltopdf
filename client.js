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

module.exports = {
  jobQueue,
  sendJob,
};
