const Queue = require('bull');

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

const JOB_MAP = {};
const JOB_SUCCESS_FUNCS = {};
const JOB_FAIL_FUNCS = {};
function onJobSuccess(job, func) {
  JOB_MAP[job.id] = job;
  if (!(job.id in JOB_SUCCESS_FUNCS)) JOB_SUCCESS_FUNCS[job.id] = [];
  JOB_SUCCESS_FUNCS[job.id].push(func);
}
function onJobFail(job, func) {
  JOB_MAP[job.id] = job;
  if (!(job.id in JOB_FAIL_FUNCS)) JOB_FAIL_FUNCS[job.id] = [];
  JOB_FAIL_FUNCS[job.id].push(func);
}

jobQueue.on('error', (err) => {
  console.log(`A queue error happened: ${err.message}`);
});
jobQueue.on('waiting', (jobid) => {
  console.log(`Job ${jobid} waiting`);
});
jobQueue.on('global:active', (jobid) => {
  console.log(`Job ${jobid} active`);
});
jobQueue.on('global:stalled', (jobid) => {
  console.log(`Job ${jobid} stalled and will be reprocessed`);
});
jobQueue.on('global:progress', (jobid, progress) => {
  console.log(`Job ${jobid} progress ${progress}`);
});
jobQueue.on('global:completed', (jobid, result) => {
  console.log(`Job ${jobid} completed. result is of size ${result.length}`);
  if (jobid in JOB_SUCCESS_FUNCS) {
    const job = JOB_MAP[jobid];
    for (let func of JOB_SUCCESS_FUNCS[jobid]) {
      func(job, result);
    }
  }
  delete JOB_MAP[jobid];
  delete JOB_SUCCESS_FUNCS[jobid];
  delete JOB_FAIL_FUNCS[jobid];
});
jobQueue.on('global:failed', (jobid, err) => {
  console.log(`Job ${jobid} failed with error ${err.message} ${err}`);
  if (jobid in JOB_FAIL_FUNCS) {
    const job = JOB_MAP[jobid];
    for (let func of JOB_FAIL_FUNCS[jobid]) {
      func(job, err);
    }
  }
  delete JOB_MAP[jobid];
  delete JOB_SUCCESS_FUNCS[jobid];
  delete JOB_FAIL_FUNCS[jobid];
});
jobQueue.on('paused', () => {
  console.log('Queue paused');
});
jobQueue.on('resumed', () => {
  console.log('Queue resumed');
});
jobQueue.on('cleaned', (jobs, type) => {
  console.log(`${jobs.length} jobs cleaned`);
});
jobQueue.on('drained', () => {
  console.log('Queue drained');
});
jobQueue.on('global:removed', (jobid) =>{
  console.log(`Job ${jobid} removed`);
});

async function sendJob(data) {
  try {
    const job = await jobQueue.add(data, {
      attempts: 3,
      timeout: 30000,
      backoff: { type: 'fixed', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: true,
    });

    console.log('saved job ' + job.id);
    return job;
  } catch (err) {
    console.log(`job failed to save: ${err}`);
    throw err;
  }
}

module.exports = {
  jobQueue,
  sendJob,
  onJobSuccess,
  onJobFail,
};
