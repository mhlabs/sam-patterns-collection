const calculation = require('../functions/calculator');
const toSNS = require('../functions/toSNS');
const S3 = require('aws-sdk/clients/s3');
const s3 = new S3();
exports.handler = async function (event, context) {
  // const result = await s3.getObject({Key: event.Key, Bucket: process.env.AccessPoint }).promise();
  const query = 'SELECT * FROM S3Object s';
  const bucket = event.Bucket;
  const key = event.Key;
  const params = {
    Bucket: bucket,
    Key: key,
    ExpressionType: 'SQL',
    Expression: query,
    ScanRange: {
      Start: event.StartByte,
      End: Math.min(
        event.StartByte + parseInt(process.env.ChunkBytes),
        event.ContentLength
      )
    },
    InputSerialization: {
      CSV: {
        FileHeaderInfo: 'USE'
      }
    },
    OutputSerialization: {
      JSON: {
        RecordDelimiter: ','
      }
    }
  };

  const results = await selectFromS3(params);
  const resultArray = await calculateScores(results);
  const promises = [];
  console.log(`Length: ${resultArray.length}`);
  for (const msg of resultArray) {
    var message = [msg]; // Single item array due to consumer logic
    promises.push(toSNS.send(message));
  }
  await Promise.all(promises);
  console.log(`${resultArray.length} articles successfully put on sns`);
};

async function selectFromS3(params) {
  return new Promise((resolve, reject) => {
    s3.selectObjectContent(params, (err, data) => {
      console.log(err);
      if (err) {
        reject(err);
      }
      if (!data) {
        reject('Empty data object');
      }
      const records = [];
      data.Payload.on('data', (event) => {
        if (event.Records) {
          records.push(event.Records.Payload);
        }
      })
        .on('error', (err) => {
          reject(err);
        })
        .on('end', () => {
          let recordsString = Buffer.concat(records).toString('utf8');
          recordsString = recordsString.replace(/\,$/, '');
          recordsString = `[${recordsString}]`;
          try {
            const data = JSON.parse(recordsString);
            resolve(data);
          } catch (e) {
            reject(
              new Error(
                `Unable to convert S3 data to JSON object. S3 Select Query: ${params.Expression}`
              )
            );
          }
        });
    });
  });
}

async function calculateScores(flattenedArray) {
  var scores = {
    sold24h: 'sold24_Score',
    sold24h_c: 'sold24Score_c',
    sold7d: 'sold7d_Score',
    sold7d_c: 'sold7dScore_c',
    sold90d: 'sold90d_Score',
    sold90d_c: 'sold90dScore_c',
    pricemargin: 'pricemarginscore'
  };

  //For each key in scores, send to calculator togheter with array of products
  for (var key in scores) {
    if (scores.hasOwnProperty(key)) {
      var shortscore = { [key]: scores[key] };
      await calculation.calculate(shortscore, flattenedArray);
    }
  }

  return flattenedArray;
};
