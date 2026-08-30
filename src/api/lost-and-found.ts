import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
// Note: We are mocking the actual OpenAI import here per the implementation plan 
// to prevent API key leakage, but in production we would use:
// import OpenAI from 'openai';

const prisma = new PrismaClient();

export const LostAndFoundController = {
  /**
   * Reports a new Lost or Found item, generates its visual embedding,
   * and queries the vector database for a highly probable visual match.
   */
  async reportItem(req: Request, res: Response) {
    try {
      const { type, imageUrl, reporterId, description } = req.body;

      if (!type || !imageUrl || !reporterId) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }

      // Step 1 & 2: Generate visual vector embedding via AI model (e.g., CLIP/OpenAI Vision)
      // MOCK: Generating a random 512-dimensional vector. 
      // In production: const embedding = await openai.embeddings.create({ ... })
      const mockEmbedding = Array.from({ length: 512 }, () => Math.random());
      
      // Step 3: Insert the record into the database using raw query to handle the vector type
      const insertQuery = `
        INSERT INTO "LostAndFoundItem" (id, type, "reporterId", "imageUrl", description, "imageEmbedding", status, "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::vector, 'OPEN', NOW())
        RETURNING id;
      `;
      
      const inserted = await prisma.$queryRawUnsafe<any[]>(
        insertQuery, 
        type, 
        reporterId, 
        imageUrl, 
        description, 
        JSON.stringify(mockEmbedding)
      );
      const newId = inserted[0]?.id;

      // Step 4: Execute pgvector cosine similarity search against items of the opposite type
      const targetType = type === 'LOST' ? 'FOUND' : 'LOST';
      
      // Vector `<=>` is the cosine distance operator in pgvector.
      // A cosine similarity of > 0.85 means a cosine distance of < 0.15.
      const matchQuery = `
        SELECT id, type, "reporterId", "imageUrl", description, 
               1 - ("imageEmbedding" <=> $1::vector) as similarity
        FROM "LostAndFoundItem"
        WHERE type = $2 AND status = 'OPEN'
        AND "imageEmbedding" <=> $1::vector < 0.15
        ORDER BY "imageEmbedding" <=> $1::vector ASC
        LIMIT 1;
      `;

      const matches = await prisma.$queryRawUnsafe<any[]>(
        matchQuery, 
        JSON.stringify(mockEmbedding),
        targetType
      );

      if (matches && matches.length > 0) {
        // Step 5: Match found! Return the highly probable visual match.
        return res.status(201).json({
          success: true,
          message: 'Item reported successfully.',
          match: matches[0] // Trigger the UI MatchAlert
        });
      }

      return res.status(201).json({ 
        success: true, 
        message: 'Item reported. No immediate visual matches found.',
        match: null 
      });

    } catch (error: any) {
      console.error("Lost and Found Vector DB Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
};
