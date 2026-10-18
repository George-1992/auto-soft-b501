import express from 'express';
import multer from 'multer';
import handleFile from '#src/services/file/process.js';
import { logger } from '#src/utils/logger.js';
import db from '#src/db/index.js';
import { usersTable } from '#src/db/schema.js';
import { handleAppRequest } from '#src/services/appRequest.js';

const router = express.Router();


router.get('/app', (req, res) => {
    // console.log('Test endpoint hit')
    logger.info('app endpoint hit')
    res.json({
        success: false,
        message: 'GET API is working!',
        data: null,
    })
})

router.post('/app', async (req, res) => {
    return await handleAppRequest(req, res)
})


// prefix is /api/v1
router.get('/test', (req, res) => {
    // console.log('Test endpoint hit')
    logger.info('Test endpoint hit')
    res.json({ message: 'API is working!' })
})

router.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: Date.now() })
})

router.get('/db', async (req, res) => {
    try {

        // // test
        // const userName = 'john' + Math.floor(Math.random() * 100000);
        // const user = {
        //     name: 'John',
        //     age: 30,
        //     email: `${userName}@example.com`,
        // };
        // const result = await db.insert(usersTable).values(user);
        // logger.info('Inserted user into database:', result);
        // //test end

        const users = await db.select().from(usersTable)
        res.json({
            success: true,
            message: 'Database connection successful',
            data: users
        })
    } catch (error) {
        logger.error(error.cause?.message || error.message);
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message || 'Unknown error'
        })
    }
})

// example endpoint to test path params, query params, and body
router.post('/example/:path1/:path2', (req, res) => {
    const { path1, path2 } = req.params
    const queryParams = req.query
    const body = req.body
    logger.info({ path1, path2, queryParams, body }, 'Example endpoint hit with parameters and body')
    res.json({
        message: 'Example endpoint received your request',
        pathParams: { path1, path2 },
        queryParams,
        body
    })
});


// plain text response
router.get('/plaintext', (req, res) => {
    res.set('Content-Type', 'text/plain')
    res.send('Hello, this is a plain text response from the API.')
})

// js response
router.get('/javascript', (req, res) => {
    res.set('Content-Type', 'application/javascript')
    res.send(`console.log('Hello from the API!')`)
})

// html response
router.get('/html', (req, res) => {
    res.set('Content-Type', 'text/html')
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>API Welcome</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #333; }
                p { color: #666; }
                .api-link { color: #007bff; text-decoration: none; }
            </style>
        </head>
        <body>
            <h1>Welcome to the API</h1>
            <p>Use <a href="/api/v1/test" class="api-link">/api/v1/test</a> to test the API.</p>
            <p>Check API health at <a href="/api/v1/health" class="api-link">/api/v1/health</a></p>
        </body>
        </html>
    `)
})

// Configure multer for file uploads
const storage = multer.memoryStorage() // Store files in memory as Buffer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only PDF files
        if (file.mimetype === 'application/pdf') {
            cb(null, true)
        } else {
            cb(new Error('Only PDF files are allowed!'), false)
        }
    }
})

// file requests - use multer middleware to handle single file upload
router.post('/file', upload.single('file'), (req, res) => {
    try {
        const resObj = handleFile(req)
        res.json(resObj)
    } catch (error) {
        res.status(400).json({
            success: false,
            warning: false,
            message: error.message || 'File upload failed',
            data: null
        })
    }
})



// // Debug: catch-all route to see what requests are coming in
// router.use((req, res) => {
//     logger.info({
//         method: req.method,
//         url: req.url,
//         params: req.params,
//         query: req.query,
//         headers: req.headers
//     }, '❌ UNMATCHED ROUTE');
//     res.status(404).json({ error: 'Route not found', url: req.url, method: req.method });
// });


export default router;
