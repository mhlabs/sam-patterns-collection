const S3 = require('aws-sdk/clients/s3');
const s3 = new S3();
exports.handler = async function (event, context) {
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
  for (const item of results) {
    //handle item
  }
  console.log(`${results.length} items processed`);
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
