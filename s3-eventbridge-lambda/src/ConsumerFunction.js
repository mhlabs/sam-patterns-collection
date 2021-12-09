const S3 = require("aws-sdk/clients/s3");
const s3 = new S3();

exports.handler = async (event) => {
  const obj = await s3
    .getObject({ Bucket: process.env.BucketName, Key: event.key })
    .promise();
  console.log(obj.Body.toString("utf-8"));
};
