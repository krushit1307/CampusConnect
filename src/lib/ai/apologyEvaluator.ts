import { LLMEvaluationResult } from '@/types/moderation';

/**
 * Evaluates the sincerity of an apology using an LLM.
 * 
 * @param apologyText - The text of the apology to evaluate
 * @returns Promise<LLMEvaluationResult>
 */
export async function evaluateApologySincerity(apologyText: string): Promise<LLMEvaluationResult> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        // Fallback for development without API key
        console.warn('OPENAI_API_KEY not found. Using mock evaluation.');
        return mockEvaluation(apologyText);
    }

    const prompt = `
    You are a behavioral analysis AI. Evaluate the following apology for sincerity.
    Criteria for sincerity: Takes responsibility, shows remorse, avoids blaming the victim, avoids sarcasm or evasiveness.
    Criteria for insincerity: Sarcastic ("I'm sorry you were so sensitive"), evasive, minimizes the harm, or blames others.
    
    Apology: "${apologyText}"
    
    Respond ONLY in the following JSON format:
    {
      "isSincere": boolean,
      "score": number (0.0 to 1.0, where 1.0 is highly sincere),
      "feedback": "Brief explanation of the evaluation"
    }
  `;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1, // Low temperature for consistent, deterministic evaluation
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        // Parse JSON response from LLM
        const parsedResponse = JSON.parse(content);

        return {
            isSincere: parsedResponse.isSincere,
            score: parsedResponse.score,
            rawResponse: content,
            feedback: parsedResponse.feedback,
        };
    } catch (error) {
        console.error('LLM evaluation failed:', error);
        throw new Error('Failed to evaluate apology. Please try again.');
    }
}

/**
 * Mock evaluation for development/testing purposes.
 */
function mockEvaluation(text: string): LLMEvaluationResult {
    const lowerText = text.toLowerCase();
    const isSarcastic = lowerText.includes('sensitive') || lowerText.includes('whatever') || lowerText.includes('sorry if');

    return {
        isSincere: !isSarcastic && text.length >= 50,
        score: isSarcastic ? 0.2 : 0.8,
        rawResponse: 'Mock evaluation',
        feedback: isSarcastic ? 'Detected evasive or minimizing language.' : 'Appears to take responsibility.',
    };
}
