import app from './app';
import dotenv from 'dotenv';
import { setupWorker } from './services/queue.service';
import { checkElasticsearch } from './services/elasticsearch.service';

dotenv.config();

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  console.log('Starting application...');

  try {
    // Check Elasticsearch connection
    await checkElasticsearch();
  } catch (error) {
    console.warn('Elasticsearch might not be available:', error);
  }

  // Setup BullMQ worker
  setupWorker();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

bootstrap();
