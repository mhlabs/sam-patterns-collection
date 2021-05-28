const S3 = require('aws-sdk/clients/s3');
const s3 = new S3();
exports.handler = async function (event, context) {
  const object = await s3
    .headObject({ Bucket: event.bucketName, Key: event.key })
    .promise();

  const startByteList = [];
  for (let i = 0; i < object.ContentLength; i += parseInt(process.env.ChunkBytes)) {
    startByteList.push(i);
  }  
  return {
    StartByteList: startByteList,
    Bucket: event.bucketName,
    Key: event.key,
    ContentLength: object.ContentLength
  };
};
