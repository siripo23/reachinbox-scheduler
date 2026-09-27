import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

export const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
});

export const checkElasticsearch = async () => {
  const health = await esClient.cluster.health();
  console.log('Elasticsearch cluster health:', health.status);
};

export const indexEmail = async (emailData: any) => {
  try {
    await esClient.index({
      index: 'emails',
      id: emailData.id,
      document: {
        emailAddress: emailData.emailAddress,
        subject: emailData.subject,
        body: emailData.body,
        status: emailData.status,
        sentAt: emailData.sentAt,
        scheduledFor: emailData.scheduledFor,
        campaignId: emailData.campaignId
      },
    });
  } catch (error) {
    console.error('Failed to index email in Elasticsearch:', error);
  }
};

export const searchEmails = async (query: string) => {
  try {
    const result = await esClient.search({
      index: 'emails',
      query: {
        multi_match: {
          query,
          fields: ['emailAddress', 'subject', 'body'],
        },
      },
    });
    return result.hits.hits.map((hit: any) => hit._source);
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
};
