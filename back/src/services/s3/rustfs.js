import { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const S3_REGION = process.env.S3_REGION || 'auto';
const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || '';
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || '';
const DEFAULT_BUCKET_NAME = process.env.S3_DEFAULT_BUCKET_NAME || 'default';

const S3 = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
    // requestChecksumCalculation: "WHEN_REQUIRED",
    // responseChecksumValidation: "WHEN_REQUIRED",
    forcePathStyle: true,
    // tls: true,
    // disableHostPrefix: true,
});


export const listS3Buckets = async () => {


    try {
        const data = await S3.send(new ListBucketsCommand({}));
        return data.Buckets || [];
    } catch (err) {
        console.error("Error listing S3 buckets:", err);
        throw err;
    }
};


export const uploadFileToS3 = async ({ key, fileContent, contentType, bucketName = DEFAULT_BUCKET_NAME, }) => {
    try {
        const params = {
            Bucket: bucketName,
            Key: key,
            Body: fileContent,
            ContentType: contentType,
        };

        const command = new PutObjectCommand(params);
        const response = await S3.send(command);
        return response;
    } catch (err) {
        console.error("Error uploading file to S3:", err);
        throw err;
    }
};

export const getFileFromS3 = async ({ key, bucketName = DEFAULT_BUCKET_NAME }) => {
    try {
        const params = {
            Bucket: bucketName,
            Key: key,
        };

        const command = new GetObjectCommand(params);
        const response = await S3.send(command);
        return response; // This will include the Body stream
        // return response.Body; // This will be a stream
    } catch (err) {
        console.error("Error getting file from S3:", err);
        throw err;
    }
};