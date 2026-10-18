import 'dotenv/config';
import '#src/jobs/jobs.index.js';
import app from '#src/app.js';
import { logger } from '#src/utils/logger.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}, http://localhost:${PORT}`);
});
