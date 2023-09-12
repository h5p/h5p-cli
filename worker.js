const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const logic = require('./logic.js');
const config = require('./config.js');
if (isMainThread) {
  const run = (input) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: input
      });
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }
  module.exports = async (list) => {
    let toDo;
    let done = 0;
    let index = 0;
    while (done < list.length) {
      toDo = [];
      for (let i = 0; i < config.maxThreads && index < list.length; i++, index++) {
        toDo.push(run(list[index]));
      }
      await Promise.all(toDo);
      done += toDo.length;
    }
  }
}
else {
  const work = async (input) => {
    const result = await logic[input.method].apply(null, input.params);
    parentPort.postMessage(result);
  }
  work(workerData);
}
