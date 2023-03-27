const aws = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");

const s3 = new aws.S3();

aws.config.update({
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_ACCESS_SECRET,
    region: process.env.S3_ORIGIN,
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type, only JPEG and PNG is allowed!"), false);
    }
};

const upload = multer({
    fileFilter,
    storage: multerS3({
        acl: "public-read",
        s3,
        bucket: process.env.S3_ORIGIN,
        metadata: function(req, file, cb) {
            console.log({ output: req })
            cb(null, { fieldName: "TESTING_METADATA" });
        },
        key: function(req, file, cb) {
            cb(null, Date.now().toString());
        },
    }),
});

module.exports = upload;