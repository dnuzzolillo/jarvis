import { Index, Pinecone, PineconeRecord, RecordMetadata } from '@pinecone-database/pinecone';
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone"
import { openaiClient } from './openai-client';
import { v4 as uuidv4 } from 'uuid';

export interface TextMetadata extends RecordMetadata, RecordMetadata {
    text: string;
    
}

export class VectorMemory {
    static client = new Pinecone();

    index: null | Index = null;
    pineconeStore: PineconeStore | null = null;
    constructor(
        public indexName: string = 'core'
    ) {}

    async indexExists(): Promise<boolean> {
        return (await VectorMemory.client.listIndexes()).indexes?.map(i => i.name).includes(this.indexName) ?? false;
    }

    async getIndex() {
        if (!this.index) {
            if (await this.indexExists()) {
                this.index = await VectorMemory.client.index(this.indexName);
            } else {
                await VectorMemory.client.createIndex({
                    name: this.indexName,
                    dimension: 3072,
                    metric: 'cosine',
                    spec: {
                        serverless: {
                            cloud: 'aws',
                            region: 'us-west-1',
                        },
                    },
                });
                this.index = await VectorMemory.client.index(this.indexName);
            }
        }
        return this.index;
    }

    async getStore() {
        if (!this.pineconeStore) {
            this.pineconeStore = await PineconeStore.fromExistingIndex(
                new OpenAIEmbeddings({
                    model: 'text-embedding-3-large',
                }),
                {
                    pineconeIndex: await this.getIndex()
                }
            );
        }
        return this.pineconeStore;
    }

    async insertDocuments(docs: Document[]) {
        return (await this.getStore()).addDocuments(docs);
    }

    async search(query: string, n: number = 10) {
        return (await this.getStore()).similaritySearchWithScore(query, n);
    }

    async wipeDocuments() {
        try {
            (await this.getStore()).delete({ deleteAll: true });
        } catch (error) {
            // do nothing
        }
    }
}