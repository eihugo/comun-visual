import app from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => console.log(`PrintFlow API em http://localhost:${env.port}`));
