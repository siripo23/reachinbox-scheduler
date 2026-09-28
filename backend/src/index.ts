import app from './app';
import dotenv from 'dotenv';
import { setupWorker } from './services/queue.service';
import { checkElasticsearch } from './services/elasticsearch.service';

dotenv.config();

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  try {
    await checkElasticsearch();
  } catch {
    console.warn('Elasticsearch not available, search will be disabled');
  }

  setupWorker();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

bootstrap();
