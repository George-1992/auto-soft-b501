import { logger } from '#src/utils/logger.js';

const handleFile = (req) => {
  const resObj = {
    success: false,
    warning: false,
    message: '',
    data: null,
  };

  try {
    if (!req || !req.file) {
      resObj.warning = true;
      resObj.message = 'No file parameter provided. Make sure to send file with key "file".';
      return resObj;
    }

    const file = req.file;
    logger.info('File received:', {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: `${file.size} bytes`,
      buffer: file.buffer ? 'Buffer received' : 'No buffer',
    });

    resObj.success = true;
    resObj.message = 'File uploaded and processed successfully!';
    resObj.data = {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };

    return resObj;
  } catch (error) {
    logger.error(error);
    resObj.message = error.message || 'An error occurred while processing the file request.';
    return resObj;
  }
};

export default handleFile;
